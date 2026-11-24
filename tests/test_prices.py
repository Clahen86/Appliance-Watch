"""Prices: Strømligning-style forecasts, cost of a cycle, cheapest start."""

from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.appliance_watch import prices


async def test_forecast_and_cheapest(hass: HomeAssistant) -> None:
    now = dt_util.utcnow().replace(minute=0, second=0, microsecond=0)
    rows = [{"start": (now + timedelta(minutes=15 * i)).isoformat(), "end": (now + timedelta(minutes=15 * (i + 1))).isoformat(),
             "price": 3.0 if i < 20 else 1.0} for i in range(96)]
    hass.states.async_set("sensor.pris", "3.0", {"unit_of_measurement": "kr/kWh", "prices": rows})
    assert prices.current(hass, "sensor.pris") == (3.0, "kr")
    found = prices.forecast(hass, "sensor.pris")
    assert len(found) >= 92
    curve = [16.0] * 60  # 1 kWh over an hour
    best = prices.cheapest(curve, found)
    assert best["saving"] > 1.5
    assert dt_util.parse_datetime(best["start"]) >= now + timedelta(hours=5)


async def test_nordpool_style(hass: HomeAssistant) -> None:
    now = dt_util.utcnow().replace(minute=0, second=0, microsecond=0)
    raw = [{"start": now + timedelta(hours=i), "end": now + timedelta(hours=i + 1), "value": 500.0} for i in range(24)]
    hass.states.async_set("sensor.np", "500", {"unit_of_measurement": "EUR/MWh", "raw_today": raw})
    assert prices.current(hass, "sensor.np")[0] == 0.5
    assert prices.forecast(hass, "sensor.np")[0][2] == 0.5


async def test_tibber_lists_and_the_extras_on_a_spot_price(hass: HomeAssistant) -> None:
    from homeassistant.util import dt as dt_util

    day0 = dt_util.start_of_local_day()
    hass.states.async_set("sensor.spot_price", "0.30", {"unit_of_measurement": "€/kWh", "today": [0.30] * 24, "tomorrow": [0.10] * 24})
    rows = prices.forecast(hass, {"price_sensor": "sensor.spot_price"})
    assert rows and rows[-1][2] == 0.10  # tomorrow's bare list read
    settings = {"price_sensor": "sensor.spot_price", "price_add": 0.20, "price_vat": 25}
    paid = prices.forecast(hass, settings)
    assert abs(paid[-1][2] - 0.375) < 1e-9  # (0.10 + 0.20) * 1.25 - "spot" in the name: tariff and VAT on top
    now, _cur = prices.current(hass, settings)
    assert abs(now - 0.625) < 1e-9
    assert day0 is not None


async def test_energy_pilots_total_price_is_used_when_there(hass: HomeAssistant) -> None:
    from datetime import timedelta

    from homeassistant.util import dt as dt_util

    h0 = dt_util.now().replace(minute=0, second=0, microsecond=0)
    plan = [{"t": (h0 + timedelta(hours=i)).isoformat(), "price": 2.0 - i * 0.1} for i in range(6)]
    hass.states.async_set("sensor.energy_pilot", "grid", {"plan": plan, "cheapest": [], "unit_of_measurement": "kr/kWh"})
    rows = prices.forecast(hass, {})  # nothing chosen: Energy Pilot's price
    assert len(rows) == 6 and rows[0][2] == 2.0
    price, cur = prices.current(hass, {})
    assert price == 2.0 and cur == "kr"


def test_a_day_with_25_hours_lands_on_the_right_hours() -> None:
    """The last Sunday of October has 25 hours in Denmark: a bare list of 25 prices, the last one at 23:00."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    cph = ZoneInfo("Europe/Copenhagen")
    day0 = datetime(2026, 10, 25, tzinfo=cph)
    out = prices.parse({"today": [float(i) for i in range(25)]}, day0)
    local = {dt_util.as_local(t).astimezone(cph).strftime("%H:%M %Z"): p for t, p in out.items()}
    assert local["23:00 CET"] == 24.0
    assert local["02:00 CEST"] == 2.0 and local["02:00 CET"] == 3.0
    quarters = prices.parse({"today": [1.0] * 100}, day0)
    assert dt_util.as_local(max(quarters)).astimezone(cph).strftime("%H:%M") == "23:45"


def test_price_at_finds_the_row() -> None:
    now = dt_util.utcnow().replace(minute=0, second=0, microsecond=0)
    rows = [(now + timedelta(minutes=15 * i), now + timedelta(minutes=15 * (i + 1)), float(i)) for i in range(96)]
    assert prices._price_at(rows, now + timedelta(minutes=31)) == 2.0
    assert prices._price_at(rows, now - timedelta(minutes=1)) is None
    assert prices._price_at(rows, now + timedelta(hours=25)) is None

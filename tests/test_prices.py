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

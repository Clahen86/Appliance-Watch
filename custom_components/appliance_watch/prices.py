"""Electricity prices: what a cycle cost, and when starting would be cheaper.

Reads the same price integrations as Energy Pilot (Strømligning, Nord Pool, Energi Data Service, Tibber, Octopus, Amber,
ENTSO-e, Zonneplan …) - or Energy Pilot's own total price. A spot price alone gets the grid tariff, taxes, a dearer
period and VAT from the settings on top, so what a cycle cost is what it really cost.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

STEP = timedelta(minutes=15)
EP = "energy_pilot"  # the price setting: Energy Pilot's own total price (with grid tariff, taxes and VAT)

# The same reading as Energy Pilot's pricefeed.py - any price integration's coming prices, whatever the shape:
# Strømligning "prices", Nord Pool "raw_today"/"today", Energi Data Service, Tibber "today"/"tomorrow", Octopus
# "rates", Amber "forecasts", ENTSO-e "prices_today", Zonneplan - and the "tomorrow" entity beside it.
LIST_KEYS = ("prices", "raw_today", "raw_tomorrow", "today", "tomorrow", "forecast", "forecasts", "rates", "data", "prices_today",
             "prices_tomorrow")
TIME_KEYS = ("start", "startsAt", "starts_at", "hour", "time", "from", "start_time", "valid_from", "datetime", "timestamp")
VALUE_KEYS = ("price", "value", "total", "price_inc_vat", "value_inc_vat", "price_ct_per_kwh", "per_kwh", "electricity_price")
SPOT_PLATFORMS = {"nordpool", "entsoe", "energyzero", "frank_energie_spot"}  # spot price only: grid tariff and taxes missing


def parse(attrs: dict[str, Any], day0: datetime) -> dict[datetime, float]:
    """{start (UTC): price per kWh} from one entity's attributes."""
    per_mwh = str(attrs.get("unit_of_measurement") or "").lower().endswith("/mwh")
    out: dict[datetime, float] = {}
    for key in LIST_KEYS:
        items = attrs.get(key)
        if not isinstance(items, list) or not items:
            continue
        if all(isinstance(x, (int, float)) for x in items):  # a bare list, one per hour or quarter
            base = day0 + timedelta(days=1 if "tomorrow" in key else 0)
            step = timedelta(hours=24 / len(items)) if len(items) in (24, 23, 25, 96, 92, 100) else timedelta(hours=1)
            for i, v in enumerate(items):
                out[dt_util.as_utc(base + i * step)] = float(v) / (1000 if per_mwh else 1)
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            start = _time(next((item[k] for k in TIME_KEYS if k in item), None))
            value = next((item[k] for k in VALUE_KEYS if isinstance(item.get(k), (int, float))), None)
            if start is None or value is None:
                continue
            used = next((k for k in VALUE_KEYS if k in item), "")
            if used.endswith("ct_per_kwh"):
                value = value / 100
            elif used == "electricity_price" and abs(value) > 100:
                value = value / 10_000_000  # Zonneplan: tenths of a micro-euro
            out[start] = float(value) / (1000 if per_mwh else 1)
    return out


def companions(hass: HomeAssistant, entity_id: str) -> list[str]:
    """The price entity and the one "tomorrow" entity of the same kind from the same integration (or Octopus' and
    Amber's known pairs)."""
    import re
    from difflib import SequenceMatcher

    obj = entity_id.split(".", 1)[1]
    prefix = obj.split("_")[0]
    base = re.sub(r"_(?:current_rate|current_day_rates|next_day_rates|previous_day_rates)$", "", obj)
    marks = lambda o: frozenset(m for m in ("vat", "spot", "export", "feed", "ex_vat", "excl", "incl", "raw") if m in o)  # noqa: E731
    has_list = lambda st: any(isinstance(st.attributes.get(k), list) for k in LIST_KEYS)  # noqa: E731
    out = [entity_id]
    exact = {f"{base}_current_day_rates", f"{base}_next_day_rates", obj.replace("_price", "_forecast")} - {obj}
    for st in hass.states.async_all(("sensor", "event")):
        if st.entity_id != entity_id and st.entity_id.split(".", 1)[1] in exact and has_list(st):
            out.append(st.entity_id)
    if len(out) == 1:
        tomorrow = [st.entity_id for st in hass.states.async_all("sensor") if st.entity_id != entity_id and has_list(st)
                    and (o := st.entity_id.split(".", 1)[1]).startswith(prefix + "_")
                    and any(w in o for w in ("tomorrow", "i_morgen", "imorgen", "morgen")) and marks(o) == marks(obj)]
        if tomorrow:
            out.append(max(tomorrow, key=lambda e: SequenceMatcher(None, e.split(".", 1)[1], obj).ratio()))
    return out


def energy_pilot(hass: HomeAssistant) -> Any:
    """Energy Pilot's main sensor (its "plan" holds the total price per hour) - found by what it holds, any language."""
    for st in hass.states.async_all("sensor"):
        plan = st.attributes.get("plan")
        if isinstance(plan, list) and plan and isinstance(plan[0], dict) and "price" in plan[0] and "cheapest" in st.attributes:
            return st
    return None


def is_spot_only(hass: HomeAssistant, entity_id: str | None) -> bool:
    """A price without grid tariff and taxes (Nord Pool, ENTSO-e …): the extras in the settings belong on top."""
    if not entity_id or entity_id == EP:
        return False
    from homeassistant.helpers import entity_registry as er

    e = er.async_get(hass).async_get(entity_id)
    return bool(e and e.platform in SPOT_PLATFORMS) or "spot" in entity_id


def _extras(settings: dict[str, Any] | None):
    """The price as paid: + grid tariff and taxes per kWh, + a dearer period (e.g. 17-21), then VAT."""
    s = settings or {}
    add, vat = float(s.get("price_add") or 0), float(s.get("price_vat") or 0)
    peak_add = float(s.get("price_peak_add") or 0)
    pf, pt = s.get("price_peak_from") or "", s.get("price_peak_to") or ""

    def total(p: float, when: datetime) -> float:
        extra = add
        if peak_add and pf and pt:
            hm = dt_util.as_local(when).strftime("%H:%M")
            if (pf <= hm < pt) if pf <= pt else (hm >= pf or hm < pt):
                extra += peak_add
        return (p + extra) * (1 + vat / 100)

    return total


def _source(hass: HomeAssistant, settings: dict[str, Any] | None) -> str | None:
    chosen = (settings or {}).get("price_sensor")
    if chosen == EP or (not chosen and energy_pilot(hass) is not None):
        return EP
    return chosen


def current(hass: HomeAssistant, settings: dict[str, Any] | str | None) -> tuple[float | None, str | None]:
    """The price now as paid, and its currency (from the unit: "kr/kWh" -> "kr")."""
    settings = {"price_sensor": settings} if isinstance(settings, str) or settings is None else settings
    src = _source(hass, settings)
    if src == EP:
        ep = energy_pilot(hass)
        rows = forecast(hass, settings)
        price = _price_at(rows, dt_util.utcnow()) if rows else None
        unit = str(ep.attributes.get("unit_of_measurement") or "") if ep else ""
        return price, (unit.split("/")[0].strip() or hass.config.currency) if price is not None else None
    if not src or (state := hass.states.get(src)) is None:
        return None, None
    try:
        value = float(state.state)
    except ValueError:
        return None, None
    unit = str(state.attributes.get("unit_of_measurement") or "")
    per = unit.split("/")[0].strip() if "/" in unit else unit
    if unit.lower().endswith("/mwh"):
        value /= 1000
    if is_spot_only(hass, src):
        value = _extras(settings)(value, dt_util.utcnow())
    return value, per or None


def forecast(hass: HomeAssistant, settings: dict[str, Any] | str | None) -> list[tuple[datetime, datetime, float]]:
    """The known prices from now on as (start, end, price per kWh as paid), in order."""
    settings = {"price_sensor": settings} if isinstance(settings, str) or settings is None else settings
    src = _source(hass, settings)
    now = dt_util.utcnow()
    prices: dict[datetime, float] = {}
    if src == EP:
        ep = energy_pilot(hass)
        for h in (ep.attributes.get("plan") or []) if ep else []:
            if isinstance(h, dict) and (t := _time(h.get("t"))) is not None and isinstance(h.get("price"), (int, float)):
                prices[t] = float(h["price"])  # already the total price
    elif src and hass.states.get(src) is not None:
        day0 = dt_util.start_of_local_day()
        for e in companions(hass, src):
            if (st := hass.states.get(e)) is not None:
                prices.update(parse(dict(st.attributes), day0))
        if is_spot_only(hass, src):
            total = _extras(settings)
            prices = {t: total(p, t) for t, p in prices.items()}
    starts = sorted(prices)
    rows = []
    for i, t in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) and starts[i + 1] - t <= timedelta(hours=1) else t + timedelta(hours=1)
        if end > now:
            rows.append((t, end, prices[t]))
    return rows


def _time(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return dt_util.as_utc(value)
    if isinstance(value, str):
        parsed = dt_util.parse_datetime(value)
        return dt_util.as_utc(parsed) if parsed else None
    return None


def _price_at(rows: list[tuple[datetime, datetime, float]], when: datetime) -> float | None:
    for start, end, price in rows:
        if start <= when < end:
            return price
    return None


def cost_of(curve: list[float], start: datetime, rows: list[tuple[datetime, datetime, float]]) -> float | None:
    """What a cycle with this curve (Wh per minute) costs if started then. None when the prices don't reach."""
    total = 0.0
    for minute, wh in enumerate(curve):
        price = _price_at(rows, start + timedelta(minutes=minute))
        if price is None:
            return None
        total += wh / 1000 * price
    return total


def cheapest(curve: list[float], rows: list[tuple[datetime, datetime, float]], hours: int = 24) -> dict[str, Any] | None:
    """The cheapest start in the coming hours for a cycle like this, against starting now."""
    if not curve or not rows:
        return None
    now = dt_util.utcnow().replace(second=0, microsecond=0)
    now_cost = cost_of(curve, now, rows)
    if now_cost is None:
        return None
    best, best_cost = now, now_cost
    when = now + STEP - timedelta(minutes=now.minute % 15)
    while when < now + timedelta(hours=hours):
        cost = cost_of(curve, when, rows)
        if cost is None:
            break
        if cost < best_cost - 1e-9:
            best, best_cost = when, cost
        when += STEP
    return {"start": best.isoformat(), "cost": round(best_cost, 2), "now_cost": round(now_cost, 2),
            "saving": round(now_cost - best_cost, 2)}

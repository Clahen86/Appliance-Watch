"""Electricity prices: what a cycle cost, and when starting would be cheaper.

Reads any price sensor whose attributes hold the coming prices - Strømligning ("prices": start/end/price), Nord Pool
("raw_today"/"raw_tomorrow": start/end/value), Energi Data Service ("raw_today": hour/price, "forecast") and the like.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

_LISTS = ("prices", "raw_today", "raw_tomorrow", "forecast", "today", "tomorrow", "data")
_TIME = ("start", "hour", "time", "from", "start_time")
_VALUE = ("price", "value", "total", "price_inc_vat")
STEP = timedelta(minutes=15)


def current(hass: HomeAssistant, entity_id: str | None) -> tuple[float | None, str | None]:
    """The price now, and its currency (from the unit: "kr/kWh" -> "kr")."""
    if not entity_id or (state := hass.states.get(entity_id)) is None:
        return None, None
    try:
        value = float(state.state)
    except ValueError:
        return None, None
    unit = str(state.attributes.get("unit_of_measurement") or "")
    per = unit.split("/")[0].strip() if "/" in unit else unit
    if unit.lower().endswith("/mwh"):
        value /= 1000
    return value, per or None


def forecast(hass: HomeAssistant, entity_id: str | None) -> list[tuple[datetime, datetime, float]]:
    """The known prices from now on as (start, end, price per kWh), in order."""
    if not entity_id or (state := hass.states.get(entity_id)) is None:
        return []
    per_mwh = str(state.attributes.get("unit_of_measurement") or "").lower().endswith("/mwh")
    rows: dict[datetime, tuple[datetime, float]] = {}
    for key in _LISTS:
        items = state.attributes.get(key)
        if not isinstance(items, list):
            continue
        parsed = []
        for item in items:
            if not isinstance(item, dict):
                continue
            start = _time(next((item[k] for k in _TIME if k in item), None))
            value = next((item[k] for k in _VALUE if isinstance(item.get(k), (int, float))), None)
            if start is None or value is None:
                continue
            end = _time(item.get("end"))
            parsed.append([start, end, float(value) / (1000 if per_mwh else 1)])
        for i, row in enumerate(parsed):
            if row[1] is None:
                row[1] = parsed[i + 1][0] if i + 1 < len(parsed) else row[0] + timedelta(hours=1)
            rows[row[0]] = (row[1], row[2])
    now = dt_util.utcnow()
    return [(s, e, p) for s, (e, p) in sorted(rows.items()) if e > now]


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

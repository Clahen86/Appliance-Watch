"""Programmes: told by the user once, recognised after that - learned only from cycles that ended clearly.

A cycle that ended in a way we can't trust (a lost power reading, a timeout, forced) is kept in the history but never
learned from, so a mistake can't teach the next one. The user's own word ("that was Eco 50°") always wins.

Pure: no Home Assistant here.
"""

from __future__ import annotations

import math
from statistics import median
from typing import Any

from .const import Profile

CLEAN_REASONS = ("quiet", "door")
SAME = 0.72  # a finished cycle this similar to a programme is that programme
LIVE_SURE = 0.6  # a running cycle this similar is probably that programme
LIVE_FROM_S = 300
SHAPE_POINTS = 48


def is_clean(cycle: dict[str, Any], profile: Profile) -> bool:
    return (
        cycle.get("end_reason") in CLEAN_REASONS
        and cycle.get("lost_s", 0) < 120
        and cycle.get("duration", 0) >= profile.min_cycle_s
        and cycle.get("wh", 0) > 1
    )


def _shape(curve: list[float], points: int = SHAPE_POINTS) -> list[float]:
    """The curve in relative time (0-100 %), as shares of all its energy."""
    if not curve:
        return [0.0] * points
    total = sum(curve) or 1.0
    n = len(curve)
    out = []
    for i in range(points):
        a, b = i * n / points, (i + 1) * n / points
        acc, x = 0.0, a
        while x < b - 1e-9:
            j = int(x)
            edge = min(b, j + 1)
            acc += curve[min(j, n - 1)] * (edge - x)
            x = edge
        out.append(acc / total)
    return out


def _ratio(a: float, b: float) -> float:
    if a <= 0 or b <= 0:
        return 0.0
    return math.exp(-3 * abs(math.log(a / b)))


def similarity(a: dict[str, Any], b: dict[str, Any]) -> float:
    """0-1: how alike two finished cycles are (length, energy, heating, and the shape of the curve)."""
    sa, sb = _shape(a.get("curve") or []), _shape(b.get("curve") or [])
    shape = 1 - sum(abs(x - y) for x, y in zip(sa, sb)) / 2
    heat = 1.0 if a.get("heat_s", 0) < 60 and b.get("heat_s", 0) < 60 else _ratio(a.get("heat_s", 0), b.get("heat_s", 0))
    return round(
        0.3 * _ratio(a.get("duration", 0), b.get("duration", 0))
        + 0.2 * _ratio(a.get("wh", 0), b.get("wh", 0))
        + 0.15 * heat
        + 0.35 * shape,
        3,
    )


def partial_similarity(live: dict[str, Any], ref: dict[str, Any], minutes: int) -> float:
    """0-1: how alike the first minutes of a running cycle are to the same minutes of a finished one."""
    a = (live.get("curve") or [])[:minutes]
    b = (ref.get("curve") or [])[:minutes]
    if len(a) < 3 or len(b) < len(a) * 0.8:
        return 0.0  # the reference was shorter than this one already is
    b = b + [0.0] * (len(a) - len(b))
    # A little slack in time: the same programme can heat a minute later with colder water.
    err = min(
        sum(abs(x - y) for x, y in zip(a, (b[s:] + [0.0] * s) if s >= 0 else ([0.0] * -s + b[:s])))
        for s in (-2, -1, 0, 1, 2)
    )
    return max(0.0, 1 - err / max(sum(a), sum(b), 1.0))


def stats(cycles: list[dict[str, Any]]) -> dict[str, Any] | None:
    """What a programme usually does, from its clean cycles."""
    if not cycles:
        return None
    gaps = [g for c in cycles for g in c.get("gaps", [])]
    costs = [c["cost"] for c in cycles if c.get("cost") is not None]
    return {
        "count": len(cycles),
        "duration": median(c["duration"] for c in cycles),
        "min_duration": min(c["duration"] for c in cycles),
        "max_duration": max(c["duration"] for c in cycles),
        "wh": median(c["wh"] for c in cycles),
        "heat_s": median(c.get("heat_s", 0) for c in cycles),
        "max_gap": max(gaps, default=0),
        "cost": round(median(costs), 2) if costs else None,
    }


def end_quiet(profile: Profile, st: dict[str, Any] | None, machine_gap: float | None = None) -> float:
    """How long a rest means "done" for this programme (or this machine, while the programme isn't known)."""
    if st and st["count"] >= 2:
        need = st["max_gap"] * 1.3 + 60
    elif st:
        need = max(st["max_gap"] * 1.5 + 90, profile.end_quiet_s * 0.6)
    elif machine_gap is not None:
        need = max(profile.end_quiet_s, machine_gap * 1.3 + 60)
    else:
        need = profile.end_quiet_s
    return float(min(max(need, profile.min_quiet_s), 1800))


def classify(cycle: dict[str, Any], programs: dict[str, list[dict[str, Any]]]) -> tuple[str | None, float]:
    """The programme a finished cycle was (its known cycles -> mean of the 3 most alike)."""
    best, score = None, 0.0
    for pid, cycles in programs.items():
        if not cycles:
            continue
        sims = sorted((similarity(cycle, c) for c in cycles), reverse=True)[:3]
        s = sum(sims) / len(sims)
        if s > score:
            best, score = pid, s
    return (best, round(score, 3)) if score >= SAME else (None, round(score, 3))


def match_live(live: dict[str, Any], elapsed: float, programs: dict[str, list[dict[str, Any]]]) -> tuple[str | None, float]:
    """The programme a running cycle probably is, from its first minutes."""
    if elapsed < LIVE_FROM_S:
        return None, 0.0
    minutes = int(elapsed // 60)
    best, score = None, 0.0
    for pid, cycles in programs.items():
        sims = sorted((partial_similarity(live, c, minutes) for c in cycles), reverse=True)[:3]
        if not sims:
            continue
        s = sum(sims) / len(sims)
        if s > score:
            best, score = pid, s
    return (best, round(score, 3)) if score >= LIVE_SURE else (None, round(score, 3))


def remaining(live: dict[str, Any], elapsed: float, st: dict[str, Any]) -> float:
    """Seconds left: where it is by time and by energy, together - the energy tells when it's ahead or behind."""
    by_time = elapsed / st["duration"] if st["duration"] else 0.0
    by_energy = live.get("wh", 0) / st["wh"] if st["wh"] else by_time
    progress = min(0.99, max(0.0, 0.5 * by_time + 0.5 * by_energy))
    return max(0.0, st["duration"] * (1 - progress))


# ---------- wear and faults ----------


def wear(cycles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Changes over months in the same programme: slower heating (limescale), longer runs."""
    found = []
    ordered = sorted(cycles, key=lambda c: c["start"])
    if len(ordered) < 10:
        return found
    first, last = ordered[:5], ordered[-5:]
    heat0, heat1 = median(c.get("heat_s", 0) for c in first), median(c.get("heat_s", 0) for c in last)
    if heat0 > 120 and heat1 > heat0 * 1.2:
        found.append({"kind": "heat_slower", "percent": round((heat1 / heat0 - 1) * 100)})
    dur0, dur1 = median(c["duration"] for c in first), median(c["duration"] for c in last)
    if dur1 > dur0 * 1.15:
        found.append({"kind": "longer", "percent": round((dur1 / dur0 - 1) * 100)})
    return found


def fault(cycle: dict[str, Any], st: dict[str, Any] | None, elapsed: float | None = None) -> str | None:
    """Something odd about one cycle: still running far too long, stopped far too early, power lost."""
    if cycle.get("end_reason") == "power_lost":
        return "power_lost"
    if st is None or st["count"] < 3:
        return None
    if elapsed is not None:
        return "too_long" if elapsed > max(st["max_duration"] * 1.5, st["max_duration"] + 2700) else None
    if cycle.get("end_reason") in CLEAN_REASONS and cycle["duration"] < st["min_duration"] * 0.5 \
            and cycle["wh"] < st["wh"] * 0.5:
        return "stopped_early"
    return None

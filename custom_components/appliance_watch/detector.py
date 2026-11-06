"""When a machine starts and when it is done - from what it does, never from a clock.

A machine is done when the work is over (no heating, no pump, no motor) and it has only been resting at a low level
for a while: a dishwasher drying at 5-15 W is done, so is one in standby at 0.3 W. How long "a while" is comes from
the programme: the longest rest seen inside that programme before it went on (learned), so a programme with long
pauses isn't called done in a pause, and a short one is called done right away.

If it starts again soon after "done" (and nobody opened the door), it wasn't done: the cycle goes on, and the pause
is learned so it doesn't happen again. A short burst after the end (a drain pump, a dryer turning the clothes) is
the machine finishing off, not a new programme.

Pure: no Home Assistant here. Times are seconds (a timestamp), power is watts.
"""

from __future__ import annotations

from typing import Any

from .const import (
    FINISHED_KEEP_S,
    MAX_CYCLE_S,
    POWER_LOST_S,
    RESUME_WINDOW_S,
    STATE_FINISHED,
    STATE_FINISHING,
    STATE_OFF,
    STATE_RUNNING,
    Profile,
)

GAP_MIN_S = 90  # a rest shorter than this is just the machine switching between steps
START_WH = 2.0  # this much work confirms a start (a drain pump on its own is less)
START_QUIET_S = 300  # a start that goes quiet this long before it is confirmed was nothing
FINISHING_AFTER_S = 60


def new_cycle(t: float) -> dict[str, Any]:
    return {
        "start": t, "end": None, "last_active": t, "wh": 0.0, "heat_s": 0.0, "active_s": 0.0, "phases": 0,
        "peak": 0.0, "gaps": [], "curve": [], "end_reason": None, "resumed": 0, "lost_s": 0.0,
    }


class Detector:
    def __init__(self, profile: Profile, standby: float | None = None) -> None:
        self.profile = profile
        self.state = STATE_OFF
        self.cycle: dict[str, Any] | None = None
        self.confirmed = False
        self.t: float | None = None  # time of the last reading
        self.w: float | None = None  # last reading (None = unavailable)
        self.standby = standby
        # Set from outside: the quiet that means "done" for the programme it is running.
        self.end_quiet_s = profile.end_quiet_s
        self.finish_after_drying = False
        self.finished_at: float | None = None
        self.door_opened = False
        self.after_bursts = 0
        self._burst: dict[str, float] | None = None
        self._unavailable_since: float | None = None
        # Just emptied while still drying at a few watts: that isn't a new (quiet) programme.
        self._low_blocked = False

    # ---------- inputs ----------

    def sample(self, t: float, w: float | None) -> list[tuple[str, Any]]:
        events = self._advance(t)
        if w is None:
            if self._unavailable_since is None:
                self._unavailable_since = t
            self.w = None
            return events + self._check(t)
        self._unavailable_since = None
        if self.state == STATE_OFF and self.cycle is None and w < self.low_w:
            self.standby = w if self.standby is None else self.standby * 0.95 + w * 0.05
        if w <= self.off_w:
            self._low_blocked = False
        if w >= self._threshold():
            events += self._active(t, w)
        self.w = w
        return events + self._check(t)

    def tick(self, t: float) -> list[tuple[str, Any]]:
        return self._advance(t) + self._check(t)

    def door(self, t: float, opened: bool) -> list[tuple[str, Any]]:
        events = self._advance(t)
        if not opened:
            return events
        if self.state == STATE_FINISHED:
            self.door_opened = True
            return events + self._emptied()
        if self.state in (STATE_RUNNING, STATE_FINISHING) and self._may_finish(t, door=True):
            events += self._finish(t, "door")
            self.door_opened = True
            return events + self._emptied()
        return events  # opened in the middle of a programme (a forgotten cup): it goes on

    def switched_off(self, t: float) -> list[tuple[str, Any]]:
        events = self._advance(t)
        if self.state in (STATE_RUNNING, STATE_FINISHING):
            events += self._finish(t, "switch")
        elif not self.confirmed:
            self.cycle = None
        return events

    def emptied(self, t: float) -> list[tuple[str, Any]]:
        events = self._advance(t)
        if self.state == STATE_FINISHED:
            return events + self._emptied()
        return events

    def force_finish(self, t: float) -> list[tuple[str, Any]]:
        events = self._advance(t)
        if self.state in (STATE_RUNNING, STATE_FINISHING):
            events += self._finish(t, "forced")
        return events

    # ---------- levels ----------

    @property
    def low_w(self) -> float:
        """A quiet programme (a cold rinse at 5-15 W) is above this - well over standby, under a pump or motor."""
        return max(4.0, self.off_w * 2)

    def _act(self) -> float:
        """Above this the running cycle is doing something: low for a quiet programme, until it shows more."""
        c = self.cycle
        return c.get("act_w", self.profile.active_w) if c else self.profile.active_w

    def _threshold(self) -> float:
        if self.state == STATE_FINISHED:
            return self.profile.active_w
        if self.cycle is None:
            return self.profile.active_w if self._low_blocked else self.low_w
        return self._act()

    def _low(self) -> bool:
        return self._act() < self.profile.active_w

    # ---------- what happens over time ----------

    def _advance(self, t: float) -> list[tuple[str, Any]]:
        """The last reading held until now: count its energy, heat and activity."""
        if self.t is None or t <= self.t:
            self.t = t if self.t is None else max(self.t, t)
            return []
        t0, w = self.t, self.w
        self.t = t
        c = self.cycle
        if c is None:
            return []
        dt = t - t0
        if w is None:
            c["lost_s"] += dt
            return []
        p = self.profile
        active = w >= (p.active_w if self.state == STATE_FINISHED else self._act())
        if self.state == STATE_FINISHED:
            if self._burst is not None and active:
                self._burst["wh"] += w * dt / 3600
                self._burst["last"] = t
            return []
        c["wh"] += w * dt / 3600
        _spread(c["curve"], t0 - c["start"], t - c["start"], w)
        if active:
            c["active_s"] += dt
            c["last_active"] = t
        if w >= p.heat_w:
            c["heat_s"] += dt
        return []

    def _active(self, t: float, w: float) -> list[tuple[str, Any]]:
        p = self.profile
        events: list[tuple[str, Any]] = []
        if self.state == STATE_FINISHED:
            return self._after_end(t, w)
        if self.cycle is None:
            self.cycle = new_cycle(t)
            self.confirmed = False
            if w < p.active_w:
                self.cycle["act_w"] = self.low_w
        c = self.cycle
        if w >= p.active_w and self._low():
            c.pop("act_w")  # more than a quiet programme: from now on only real work counts
        quiet = t - c["last_active"]
        if self.confirmed and quiet >= GAP_MIN_S and (self.w is None or self.w < self._act()):
            c["gaps"].append(round(quiet))
        if w >= p.heat_w and (self.w is None or self.w < p.heat_w):
            c["phases"] += 1
        c["peak"] = max(c["peak"], w)
        c["last_active"] = t
        if self.state == STATE_FINISHING:
            self.state = STATE_RUNNING
            events.append(("running", c))
        return events

    def _after_end(self, t: float, w: float) -> list[tuple[str, Any]]:
        """Activity after "done": the machine finishing off, it going on, or a new programme."""
        p = self.profile
        if self._burst is None:
            self._burst = {"t": t, "wh": 0.0, "last": t, "heat": 0.0}
        if w >= p.heat_w:
            self._burst["heat"] = 1.0
        return []

    def _check(self, t: float) -> list[tuple[str, Any]]:
        p = self.profile
        c = self.cycle
        events: list[tuple[str, Any]] = []
        if self.state == STATE_FINISHED:
            return self._check_finished(t)
        if c is None:
            return events
        quiet = t - c["last_active"] if (self.w is None or self.w < self._act()) else 0.0
        if not self.confirmed:
            low_start = self._low() and c["active_s"] >= 180 and c["wh"] >= 0.4
            if c["heat_s"] > 0 or (c["wh"] >= START_WH and t - c["start"] >= 60) or low_start:
                self.confirmed = True
                self.state = STATE_RUNNING
                events.append(("started", c))
            elif quiet >= START_QUIET_S:
                self.cycle = None
            return events
        if self._unavailable_since is not None:
            # No reading is not a rest: wait for it to come back, or give up after a while.
            if t - self._unavailable_since >= POWER_LOST_S:
                return events + self._finish(t, "power_lost")
            return events
        if t - c["start"] >= MAX_CYCLE_S:
            return events + self._finish(t, "timeout")
        if quiet <= 0:
            return events
        if self._may_finish(t):
            return events + self._finish(t, "quiet")
        heated = c["heat_s"] > 0 or not p.needs_heat or self._low()
        # "Nearly done" only after a rest longer than the programme's own pauses, so it doesn't flicker.
        if self.state == STATE_RUNNING and quiet >= max(FINISHING_AFTER_S, self.end_quiet_s * 0.75) and heated \
                and t - c["start"] >= p.min_cycle_s:
            self.state = STATE_FINISHING
            events.append(("finishing", c))
        return events

    def _may_finish(self, t: float, door: bool = False) -> bool:
        p, c = self.profile, self.cycle
        if c is None:
            return False
        if self.w is not None and self.w >= self._act():
            return False
        quiet = t - c["last_active"]
        heated = c["heat_s"] > 0 or not p.needs_heat or self._low()
        if door:
            return quiet >= 30 and heated and t - c["start"] >= p.min_cycle_s
        need = self.end_quiet_s if heated else max(self.end_quiet_s, 1200)
        if quiet < need:
            return False
        if self.finish_after_drying and self.w is not None and self.w > self.off_w:
            return quiet >= 4 * 3600  # still drying, but nothing dries for hours
        return True

    @property
    def off_w(self) -> float:
        """At or under this it is switched off or in standby (not drying)."""
        base = self.standby if self.standby is not None else 0.5
        return max(2.0, base * 3, base + 1.5)

    def _finish(self, t: float, reason: str) -> list[tuple[str, Any]]:
        c = self.cycle
        assert c is not None
        c["end"] = c["last_active"] if reason in ("quiet", "door") else t
        c["end_reason"] = reason
        c["duration"] = round(c["end"] - c["start"])
        if c["duration"] < self.profile.min_cycle_s and reason in ("quiet", "door", "switch"):
            self._reset()
            return [("false_start", c)]
        self.state = STATE_FINISHED
        self.finished_at = t
        self.door_opened = reason == "door"
        self.after_bursts = 0
        self._burst = None
        return [("finished", c)]

    def _check_finished(self, t: float) -> list[tuple[str, Any]]:
        p, b, c = self.profile, self._burst, self.cycle
        assert c is not None and self.finished_at is not None
        if b is not None:
            long_enough = b["last"] - b["t"] >= p.burst_s or b["wh"] >= 3 * START_WH or b["heat"]
            soon = b["t"] - self.finished_at <= RESUME_WINDOW_S
            if long_enough and soon and not self.door_opened and c["end_reason"] == "quiet":
                return self._resume(t)
            if long_enough:
                # A new programme: the last one was emptied without anyone telling.
                events = self._emptied()
                self.cycle = new_cycle(b["t"])
                self.cycle["wh"] = b["wh"]
                self.cycle["last_active"] = b["last"]
                self.cycle["heat_s"] = 60.0 if b["heat"] else 0.0
                return events + self._check(t)
            if self.w is not None and self.w < p.active_w and t - b["last"] >= 60:
                self.after_bursts += 1
                self._burst = None
        if t - self.finished_at >= FINISHED_KEEP_S:
            return self._emptied()
        return []

    def _resume(self, t: float) -> list[tuple[str, Any]]:
        """It wasn't done: the rest it took is part of the programme."""
        c, b = self.cycle, self._burst
        assert c is not None and b is not None
        c["gaps"].append(round(b["t"] - c["last_active"]))
        c["resumed"] += 1
        c["wh"] += b["wh"]
        c["last_active"] = b["last"]
        if b["heat"]:
            c["phases"] += 1
        c["end"] = c["end_reason"] = None
        c.pop("duration", None)
        self._burst = None
        self.finished_at = None
        self.state = STATE_RUNNING
        return [("resumed", c)]

    def _emptied(self) -> list[tuple[str, Any]]:
        self._low_blocked = self.w is not None and self.w > self.off_w
        self._reset()
        return [("emptied", None)]

    def _reset(self) -> None:
        self.state = STATE_OFF
        self.cycle = None
        self.confirmed = False
        self.finished_at = None
        self._burst = None

    # ---------- keeping it over a restart ----------

    def dump(self) -> dict[str, Any]:
        return {
            "state": self.state, "cycle": self.cycle, "confirmed": self.confirmed, "t": self.t, "w": self.w,
            "standby": self.standby, "finished_at": self.finished_at, "door_opened": self.door_opened,
        }

    def load(self, data: dict[str, Any] | None, now: float) -> None:
        if not data:
            return
        self.standby = data.get("standby", self.standby)
        state = data.get("state", STATE_OFF)
        if state == STATE_OFF or data.get("cycle") is None:
            return
        # Home Assistant was off for a while: what happened meanwhile is unknown, so the time is counted as lost.
        self.state = state
        self.cycle = data["cycle"]
        self.confirmed = bool(data.get("confirmed"))
        self.finished_at = data.get("finished_at")
        self.door_opened = bool(data.get("door_opened"))
        self.t = now
        self.w = None
        if self.state in (STATE_RUNNING, STATE_FINISHING) and data.get("t"):
            self.cycle["lost_s"] += max(0.0, now - data["t"])
            self._unavailable_since = now


def _spread(curve: list[float], a: float, b: float, w: float) -> None:
    """Add w watts from a to b seconds (since start) into a curve of watt-hours per minute."""
    while a < b:
        i = int(a // 60)
        edge = min(b, (i + 1) * 60)
        while len(curve) <= i:
            curve.append(0.0)
        curve[i] += w * (edge - a) / 3600
        a = edge

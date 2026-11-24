"""Machines that run all the time - a freezer or fridge, a dehumidifier: watched for trouble instead of cycles.

- Freezer / fridge: the compressor starts and stops all day. Trouble is when it hasn't run for hours (it has stopped -
  the food thaws) or hasn't stopped for far longer than it ever does (the door is open, or it is failing), or the
  reading is gone. What is normal is learned per machine: the level it runs at (an inverter compressor runs at 15 W,
  an old one at 100 W), and its longest normal run and rest. One that runs all the time by design is never "nonstop".
- Dehumidifier: trouble is when it ran and then went completely quiet - most often the tank is full. Many stop at
  their target humidity and start again by themselves: those rests are learned (how long, at what level), and only a
  rest unlike them is a full tank.

One alert per trouble; it clears by itself when the machine works normally again. Pure: no Home Assistant here.
Times are seconds (a timestamp), power is watts.
"""

from __future__ import annotations

from typing import Any

from .const import KIND_DEHUMIDIFIER, STATE_ALERT, STATE_OFF, STATE_RUNNING

FREEZER_SILENT_S = 4 * 3600  # no compressor run for this long (at least): stopped
FREEZER_NONSTOP_S = 3 * 3600  # running without a break at least this long: the door is open, or it is failing
FREEZER_RUNS = 3  # normal runs seen before "nonstop" can be told
LOST_S = 45 * 60  # the reading gone this long
DEHUM_RAN_S = 20 * 60  # it must have run this long before a stop means anything
DEHUM_QUIET_S = 15 * 60  # then fully quiet this long: the tank is probably full
DEHUM_LEARN_QUIET_S = 45 * 60  # ... while its normal rests aren't known yet
DEHUM_RESTS = 4  # rests that ended by themselves within a day: it rests at its target (a full tank isn't that often)
DEHUM_OFF_W = 3.0  # below this it is off (a dehumidifier at its target still runs the fan)
KEYS = ("on", "on_since", "off_since", "started", "alert", "alert_since", "idle_w", "run_w", "runs", "max_on", "max_off",
        "rests")


class Watcher:
    def __init__(self, kind: str, active_w: float) -> None:
        self.kind, self.active_w = kind, active_w
        self.on = False
        self.on_since: float | None = None
        self.off_since: float | None = None
        self.started: float | None = None  # the first reading - "silent for hours" counts from here at most
        self.unavailable_since: float | None = None
        self.alert: str | None = None  # "stopped", "nonstop", "lost", "tank"
        self.alert_since: float | None = None
        self.w: float | None = None
        # Learned: the lowest level (only electronics), the level it runs at, its normal runs and rests.
        self.idle_w: float | None = None
        self.run_w: float | None = None
        self.runs = 0
        self.max_on = 0.0
        self.max_off = 0.0
        self.rests: list[list[float]] = []  # dehumidifier: [ended, seconds, mean W] of rests that ended by themselves
        self._rest_sum = 0.0
        self._rest_n = 0

    @property
    def state(self) -> str:
        return STATE_ALERT if self.alert else STATE_RUNNING if self.on else STATE_OFF

    @property
    def threshold(self) -> float:
        """Above this it runs. A freezer: a little over its lowest level, so a low inverter compressor counts too."""
        if self.kind == KIND_DEHUMIDIFIER or self.idle_w is None:
            return self.active_w
        return min(self.active_w, max(5.0, self.idle_w * 2 + 2))

    def sample(self, t: float, w: float | None) -> list[tuple[str, Any]]:
        self.started = self.started or t
        self.w = w
        if w is None:
            self.unavailable_since = self.unavailable_since or t
            return self.tick(t)
        self.unavailable_since = None
        if w >= 0:
            self.idle_w = w if self.idle_w is None else min(self.idle_w, w)
        was_on = self.on
        self.on = w >= self.threshold
        if self.on:
            self.run_w = w if self.run_w is None else self.run_w * 0.98 + w * 0.02
        if self.on and not was_on:
            self._rest_ended(t)
            self.on_since, self.off_since = t, None
        elif not self.on and was_on:
            self._run_ended(t)
            self.off_since = t
        elif not self.on and self.off_since is None:
            self.off_since = t
        if not self.on:
            self._rest_sum += w
            self._rest_n += 1
        return self.tick(t)

    def _run_ended(self, t: float) -> None:
        self._rest_sum, self._rest_n = 0.0, 0
        if self.on_since is None or self.alert:
            return
        run = t - self.on_since
        if run < self._nonstop_after():  # a normal run (a nonstop one isn't learned as normal)
            self.runs += 1
            self.max_on = max(self.max_on, run)

    def _rest_ended(self, t: float) -> None:
        if self.off_since is None:
            return
        rest = t - self.off_since
        if self.kind == KIND_DEHUMIDIFIER:
            # Also one that got a "tank" alert: if it happens several times a day, it is how it rests at its target.
            if self._rest_n and rest >= 60:
                self.rests = (self.rests + [[round(t), round(rest), round(self._rest_sum / self._rest_n, 2)]])[-30:]
        elif rest < self._silent_after() and not self.alert:
            self.max_off = max(self.max_off, rest)

    def _nonstop_after(self) -> float:
        return max(FREEZER_NONSTOP_S, 1.5 * self.max_on)

    def _silent_after(self) -> float:
        return max(FREEZER_SILENT_S, 2 * self.max_off)

    def tick(self, t: float) -> list[tuple[str, Any]]:
        trouble = self._trouble(t)
        if trouble and trouble != self.alert:
            self.alert, self.alert_since = trouble, t
            return [("alert", trouble)]
        if not trouble and self.alert:
            gone, self.alert, self.alert_since = self.alert, None, None
            return [("ok", gone)]
        return []

    def _trouble(self, t: float) -> str | None:
        if self.unavailable_since is not None and t - self.unavailable_since >= LOST_S:
            return "lost"
        if self.unavailable_since is not None:
            return self.alert  # a short gap changes nothing
        if self.kind == KIND_DEHUMIDIFIER:
            ran = self.on_since is not None and self.off_since is not None and self.off_since - self.on_since >= DEHUM_RAN_S
            quiet = not self.on and self.off_since is not None and (self.w or 0) < DEHUM_OFF_W
            if ran and quiet and t - self.off_since >= self._tank_after(t):
                return "tank"
            return self.alert if self.alert == "tank" and not self.on else None
        # freezer / fridge
        if self.on and self.on_since is not None and self.runs >= FREEZER_RUNS and t - self.on_since >= self._nonstop_after():
            return "nonstop"
        silent_from = self.off_since if self.off_since is not None else self.started
        if not self.on and silent_from is not None and t - silent_from >= self._silent_after():
            return "stopped"
        return None

    def _tank_after(self, t: float) -> float:
        """How long fully quiet means a full tank: soon when it isn't like its normal rests, else much longer."""
        recent = [r for r in self.rests if t - r[0] <= 24 * 3600]
        if len(recent) < DEHUM_RESTS:
            return DEHUM_LEARN_QUIET_S
        lengths = sorted(r[1] for r in recent)
        levels = sorted(r[2] for r in recent)
        usual_s = lengths[int(len(lengths) * 0.75)]  # a full tank now and then doesn't count as normal
        usual_w = levels[len(levels) // 2]
        level = self._rest_sum / self._rest_n if self._rest_n else (self.w or 0.0)
        if abs(level - usual_w) > max(0.8, 0.5 * usual_w):
            return DEHUM_QUIET_S  # quiet at another level than when it rests at its target
        return max(DEHUM_QUIET_S, 2 * usual_s)

    def dump(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in KEYS}

    def load(self, data: dict[str, Any] | None, now: float | None = None) -> None:
        for k, v in (data or {}).items():
            if k in KEYS:
                setattr(self, k, v)
        if now is not None:
            # Home Assistant was off: how long it ran or rested meanwhile is unknown - count from now, not from then.
            self.started = now
            if self.on_since is not None and self.on:
                self.on_since = now
            if self.off_since is not None and not self.on:
                self.off_since = now

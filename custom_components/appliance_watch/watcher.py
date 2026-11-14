"""Machines that run all the time - a freezer or fridge, a dehumidifier: watched for trouble instead of cycles.

- Freezer / fridge: the compressor starts and stops all day. Trouble is when it hasn't run for hours (it has stopped -
  the food thaws) or hasn't stopped for hours (the door is open, or it is failing), or the reading is gone.
- Dehumidifier: trouble is when it ran and then went completely quiet - most often the tank is full.

One alert per trouble; it clears by itself when the machine works normally again. Pure: no Home Assistant here.
Times are seconds (a timestamp), power is watts.
"""

from __future__ import annotations

from typing import Any

from .const import KIND_DEHUMIDIFIER, STATE_ALERT, STATE_OFF, STATE_RUNNING

FREEZER_SILENT_S = 4 * 3600  # no compressor run for this long: stopped
FREEZER_NONSTOP_S = 3 * 3600  # running without a break this long: the door is open, or it is failing
LOST_S = 45 * 60  # the reading gone this long
DEHUM_RAN_S = 20 * 60  # it must have run this long before a stop means anything
DEHUM_QUIET_S = 15 * 60  # then fully quiet this long: the tank is probably full
DEHUM_OFF_W = 3.0  # below this it is off (a dehumidifier at its target still runs the fan)


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

    @property
    def state(self) -> str:
        return STATE_ALERT if self.alert else STATE_RUNNING if self.on else STATE_OFF

    def sample(self, t: float, w: float | None) -> list[tuple[str, Any]]:
        self.started = self.started or t
        self.w = w
        if w is None:
            self.unavailable_since = self.unavailable_since or t
            return self.tick(t)
        self.unavailable_since = None
        was_on = self.on
        self.on = w >= self.active_w
        if self.on and not was_on:
            self.on_since, self.off_since = t, None
        elif not self.on and was_on:
            self.off_since = t
        elif not self.on and self.off_since is None:
            self.off_since = t
        return self.tick(t)

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
            quiet = not self.on and self.off_since is not None and (self.w or 0) < DEHUM_OFF_W and t - self.off_since >= DEHUM_QUIET_S
            if ran and quiet:
                return "tank"
            return self.alert if self.alert == "tank" and not self.on else None
        # freezer / fridge
        if self.on and self.on_since is not None and t - self.on_since >= FREEZER_NONSTOP_S:
            return "nonstop"
        silent_from = self.off_since if self.off_since is not None else self.started
        if not self.on and silent_from is not None and t - silent_from >= FREEZER_SILENT_S:
            return "stopped"
        return None

    def dump(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in ("on", "on_since", "off_since", "started", "alert", "alert_since")}

    def load(self, data: dict[str, Any] | None) -> None:
        for k, v in (data or {}).items():
            if k in ("on", "on_since", "off_since", "started", "alert", "alert_since"):
                setattr(self, k, v)

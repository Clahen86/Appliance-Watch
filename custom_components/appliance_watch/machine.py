"""One machine: listens to its power (and door, switch, energy meter), runs the detector, learns, tells."""

from __future__ import annotations

from datetime import datetime, timedelta
import logging
import time
from typing import TYPE_CHECKING, Any
import uuid

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import learning, prices
from .const import (
    CONF_DOOR,
    CONF_ENERGY,
    CONF_KIND,
    CONF_POWER,
    CONF_SWITCH,
    CYCLES_KEPT,
    DOMAIN,
    EVENT_EMPTIED,
    EVENT_FINISHED,
    EVENT_STARTED,
    KIND_DRYER,
    KIND_OTHER,
    KIND_WASHER,
    PROFILES,
    SET_CHEAP,
    SET_FINISH_AFTER_DRY,
    SET_NOTIFY_START,
    SET_PRICE,
    SET_REMIND,
    SIGNAL_UPDATE,
    STATE_FINISHED,
    STATE_FINISHING,
    STATE_OFF,
    STATE_RUNNING,
)
from .detector import Detector
from .texts import ICONS, duration, money, t

if TYPE_CHECKING:
    from .hub import Hub

_LOGGER = logging.getLogger(__name__)
TICK = timedelta(seconds=30)
SAVE_EVERY = 300


class Machine:
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, hub: Hub) -> None:
        self.hass, self.entry, self.hub = hass, entry, hub
        self.store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}")
        self.cycles: list[dict[str, Any]] = []
        self.programs: dict[str, dict[str, Any]] = {}
        self.findings: list[dict[str, Any]] = []
        self.detector = Detector(self.profile)
        self.live_program: str | None = None
        self.live_score = 0.0
        self.finish_time: datetime | None = None
        self.progress: float | None = None
        self.power: float | None = None
        self.cheap: dict[str, Any] | None = None
        self.notified_done: float | None = None
        self._last_wh = 0.0
        self._saved = 0.0
        self._unsubs: list[Any] = []
        self._remind_cancel: Any = None

    # ---------- what it is ----------

    @property
    def kind(self) -> str:
        return self.option(CONF_KIND) or KIND_OTHER

    @property
    def profile(self):
        return PROFILES.get(self.kind, PROFILES[KIND_OTHER])

    @property
    def name(self) -> str:
        return self.entry.title

    def option(self, key: str) -> Any:
        # Once the machine's settings were changed, the options hold all of them (a cleared one is gone).
        if key != CONF_POWER and self.entry.options:
            return self.entry.options.get(key)
        return self.entry.data.get(key)

    @property
    def state(self) -> str:
        return self.detector.state

    @property
    def live(self) -> dict[str, Any] | None:
        return self.detector.cycle if self.detector.confirmed else None

    def program_name(self, pid: str | None, language: str | None = None) -> str | None:
        if pid is None or (p := self.programs.get(pid)) is None:
            return None
        return p.get("name") or f"{t(self.hass, 'program', language)} {p.get('number', 1)}"

    def learned(self) -> dict[str, list[dict[str, Any]]]:
        """Clean cycles per programme - all the learning comes from these."""
        out: dict[str, list[dict[str, Any]]] = {pid: [] for pid in self.programs}
        for c in self.cycles:
            if c.get("program") in out and c.get("clean"):
                out[c["program"]].append(c)
        return out

    def program_stats(self, pid: str | None) -> dict[str, Any] | None:
        return learning.stats(self.learned().get(pid, [])) if pid else None

    # ---------- start and stop ----------

    async def async_start(self) -> None:
        data = await self.store.async_load() or {}
        self.cycles = data.get("cycles", [])
        self.programs = data.get("programs", {})
        self.findings = data.get("findings", [])
        self.notified_done = data.get("notified_done")
        self.detector.load(data.get("detector"), time.time())
        self.detector.finish_after_drying = bool(self.hub.settings.get(SET_FINISH_AFTER_DRY))
        self._last_wh = (self.detector.cycle or {}).get("wh", 0.0)
        self._update_quiet()
        power = self.option(CONF_POWER)
        watch = [power] + [e for e in (self.option(CONF_DOOR), self.option(CONF_SWITCH)) if e]
        self._unsubs.append(async_track_state_change_event(self.hass, watch, self._changed))
        self._unsubs.append(async_track_time_interval(self.hass, self._tick, TICK))
        self._unsubs.append(self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._on_stop))
        if (state := self.hass.states.get(power)) is not None:
            self._handle(self.detector.sample(time.time(), _watts(state.state, state.attributes)))
        self._refresh()

    async def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        if self._remind_cancel:
            self._remind_cancel()
        await self._save()

    async def _on_stop(self, _event: Event) -> None:
        await self._save()

    async def _save(self) -> None:
        self._saved = time.time()
        await self.store.async_save({
            "cycles": self.cycles[-CYCLES_KEPT:], "programs": self.programs, "findings": self.findings,
            "detector": self.detector.dump(), "notified_done": self.notified_done,
        })

    @callback
    def _schedule_save(self, now: bool = False) -> None:
        if now or time.time() - self._saved > SAVE_EVERY:
            self._saved = time.time()
            self.hass.async_create_task(self._save(), eager_start=False)

    # ---------- inputs ----------

    @callback
    def _changed(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        new = event.data["new_state"]
        now = time.time()
        if entity_id == self.option(CONF_POWER):
            self._handle(self.detector.sample(now, _watts(new.state, new.attributes) if new else None))
        elif entity_id == self.option(CONF_DOOR) and new is not None:
            self._handle(self.detector.door(now, new.state == STATE_ON))
        elif entity_id == self.option(CONF_SWITCH) and new is not None and new.state == "off":
            self._handle(self.detector.switched_off(now))
        self._refresh()

    @callback
    def _tick(self, _now: datetime) -> None:
        self._handle(self.detector.tick(time.time()))
        self._refresh()
        if self.state != STATE_OFF:
            self._schedule_save()

    @callback
    def async_emptied(self) -> None:
        self._handle(self.detector.emptied(time.time()))
        self._refresh()

    @callback
    def async_force_finish(self) -> None:
        self._handle(self.detector.force_finish(time.time()))
        self._refresh()

    # ---------- what happened ----------

    @callback
    def _handle(self, events: list[tuple[str, Any]]) -> None:
        for kind, cycle in events:
            if kind == "started":
                self._started(cycle)
            elif kind == "finished":
                self._finished(cycle)
            elif kind == "resumed":
                self._resumed(cycle)
            elif kind == "emptied":
                self._emptied()
            elif kind == "false_start":
                self.live_program, self._last_wh = None, 0.0

    def _started(self, cycle: dict[str, Any]) -> None:
        cycle["id"] = uuid.uuid4().hex[:12]
        cycle["meter_start"] = self._meter()
        cycle["cost"] = 0.0 if self._price()[0] is not None else None
        self._last_wh = 0.0
        self._count_cost()
        self.live_program, self.live_score = None, 0.0
        self.findings = [f for f in self.findings if f.get("live") is None]
        self._update_quiet()
        self.hass.bus.async_fire(EVENT_STARTED, {"entry_id": self.entry.entry_id, "name": self.name, "kind": self.kind})
        if self.hub.settings.get(SET_NOTIFY_START):
            self.hass.async_create_task(self._notify_start(), eager_start=False)
        self._schedule_save(True)

    def _finished(self, cycle: dict[str, Any]) -> None:
        self._count_cost()
        self._use_meter(cycle)
        cycle["clean"] = learning.is_clean(cycle, self.profile)
        cycle["at"] = dt_util.utc_from_timestamp(cycle["end"]).isoformat()
        if cycle.get("program") is None:
            pid, score = learning.classify(cycle, self.learned())
            if pid is None and cycle["clean"]:
                pid = self._new_program()
            cycle["program"], cycle["score"] = pid, score
            cycle["by"] = "auto"
        if cycle.get("cost") is not None:
            cycle["cost"] = round(cycle["cost"], 2)
        cycle.pop("cost_wh", None)
        st = self.program_stats(cycle["program"])
        problem = learning.fault(cycle, st)
        self.cycles.append(cycle)
        self.cycles = self.cycles[-CYCLES_KEPT:]
        self._check_wear()
        if problem:
            self._finding(problem, cycle)
        self.live_program, self.finish_time, self.progress = None, None, None
        self.hass.bus.async_fire(EVENT_FINISHED, {
            "entry_id": self.entry.entry_id, "name": self.name, "kind": self.kind,
            "program": self.program_name(cycle["program"]), "duration": cycle["duration"],
            "energy_kwh": round(cycle["wh"] / 1000, 3), "cost": cycle.get("cost"),
        })
        self.notified_done = time.time()
        self.hass.async_create_task(self._notify_done(cycle), eager_start=False)
        self._remind_later()
        self._schedule_save(True)

    def _resumed(self, cycle: dict[str, Any]) -> None:
        # It wasn't done: take the cycle back from the history; the pause is in its gaps now.
        self.cycles = [c for c in self.cycles if c.get("id") != cycle.get("id")]
        if cycle.get("by") != "user":
            cycle["program"] = None
            cycle.pop("by", None)
        for key in ("clean", "at", "score"):
            cycle.pop(key, None)
        if self._remind_cancel:
            self._remind_cancel()
            self._remind_cancel = None
        if self.notified_done and time.time() - self.notified_done < 3600:
            self.hass.async_create_task(self.hub.async_notify(
                self, t(self.hass, "resumed_title", icon=ICONS.get(self.kind, ""), name=self.name),
                t(self.hass, "resumed")), eager_start=False)
        self.notified_done = None
        self._update_quiet()
        self._schedule_save(True)

    def _emptied(self) -> None:
        if self._remind_cancel:
            self._remind_cancel()
            self._remind_cancel = None
        self.notified_done = None
        self.hass.bus.async_fire(EVENT_EMPTIED, {"entry_id": self.entry.entry_id, "name": self.name})
        self.hass.async_create_task(self.hub.async_clear(self), eager_start=False)
        self._schedule_save(True)

    # ---------- while it runs ----------

    def _refresh(self) -> None:
        c = self.live
        now = time.time()
        self.power = self.detector.w
        if c is not None and self.state in (STATE_RUNNING, STATE_FINISHING):
            self._count_cost()
            elapsed = now - c["start"]
            if c.get("program") and c.get("by") == "user":
                self.live_program, self.live_score = c["program"], 1.0
            else:
                self.live_program, self.live_score = learning.match_live(c, elapsed, self.learned())
            self._update_quiet()
            st = self.program_stats(self.live_program)
            if st:
                left = learning.remaining(c, elapsed, st)
                if self.state == STATE_FINISHING:
                    left = min(left, max(0.0, self.detector.end_quiet_s - (now - c["last_active"])))
                self.finish_time = dt_util.utcnow() + timedelta(seconds=left)
                self.progress = round(min(99.0, 100 * elapsed / max(1.0, elapsed + left)), 1)
            else:
                self.finish_time, self.progress = None, None
            problem = learning.fault(c, st, elapsed)
            if problem and not any(f.get("live") == c.get("id") for f in self.findings):
                self._finding(problem, c, live=True)
        elif self.state == STATE_FINISHED:
            self.finish_time, self.progress = None, 100.0
        else:
            self.finish_time, self.progress = None, None
        self.cheap = self._cheapest() if self.state == STATE_OFF else None
        async_dispatcher_send(self.hass, SIGNAL_UPDATE.format(self.entry.entry_id))
        self.hub.async_changed()

    def _update_quiet(self) -> None:
        st = self.program_stats(self.live_program)
        clean = [c for c in self.cycles if c.get("clean")]
        machine_gap = max((g for c in clean for g in c.get("gaps", [])), default=0) if len(clean) >= 3 else None
        quiet = learning.end_quiet(self.profile, st, machine_gap)
        c = self.live
        if st and c is not None and self.live_score >= learning.LIVE_SURE and st["count"] >= 2:
            elapsed = time.time() - c["start"]
            if c["wh"] < st["wh"] * 0.5 and elapsed < st["min_duration"] * 0.7:
                quiet = max(quiet, 1200.0)  # far from done by its energy: a long rest is a pause, not the end
        self.detector.end_quiet_s = quiet

    def _count_cost(self) -> None:
        c = self.detector.cycle
        if c is None or c.get("cost") is None:
            return
        price, _ = self._price()
        delta = c["wh"] - self._last_wh
        self._last_wh = c["wh"]
        if price is not None and delta > 0:
            c["cost"] += delta / 1000 * price

    def _price(self) -> tuple[float | None, str | None]:
        return prices.current(self.hass, self.hub.settings.get(SET_PRICE))

    @property
    def currency(self) -> str | None:
        return self._price()[1]

    def _meter(self) -> float | None:
        entity_id = self.option(CONF_ENERGY)
        if not entity_id or (state := self.hass.states.get(entity_id)) is None:
            return None
        try:
            value = float(state.state)
        except ValueError:
            return None
        unit = str(state.attributes.get("unit_of_measurement") or "kWh")
        return value * (1000 if unit == "kWh" else 1000000 if unit == "MWh" else 1)

    def _use_meter(self, cycle: dict[str, Any]) -> None:
        """The energy meter is more exact than adding up power readings - use it when the two agree roughly."""
        start, end = cycle.pop("meter_start", None), self._meter()
        if start is None or end is None:
            return
        wh = end - start
        if cycle["wh"] > 0 and 0.5 * cycle["wh"] <= wh <= 2 * cycle["wh"]:
            scale = wh / cycle["wh"]
            cycle["curve"] = [round(x * scale, 2) for x in cycle["curve"]]
            if cycle.get("cost") is not None:
                cycle["cost"] *= scale
            cycle["wh"] = wh

    def _cheapest(self) -> dict[str, Any] | None:
        """For a machine that is off: when its usual programme would be cheapest to start."""
        if not self.cycles or not self.hub.settings.get(SET_PRICE):
            return None
        pid = next((c.get("program") for c in reversed(self.cycles) if c.get("program")), None)
        ref = next((c for c in reversed(self.cycles) if c.get("program") == pid and c.get("clean")), None)
        if ref is None:
            return None
        found = prices.cheapest(ref["curve"], prices.forecast(self.hass, self.hub.settings.get(SET_PRICE)))
        if found is None or found["saving"] < float(self.hub.settings.get(SET_CHEAP) or 0):
            return None
        return {**found, "program": self.program_name(pid)}

    # ---------- programmes ----------

    def _new_program(self) -> str:
        number = max((p.get("number", 0) for p in self.programs.values()), default=0) + 1
        pid = uuid.uuid4().hex[:8]
        self.programs[pid] = {"name": None, "number": number}
        return pid

    def program_by_name(self, name: str) -> str:
        for pid, p in self.programs.items():
            if (p.get("name") or "").lower() == name.strip().lower():
                return pid
        pid = self._new_program()
        self.programs[pid]["name"] = name.strip()
        return pid

    async def async_add_program(self, name: str) -> None:
        if name.strip():
            self.program_by_name(name)
            self._refresh()
            await self._save()

    async def async_label(self, cycle_id: str, name: str | None = None, program: str | None = None) -> None:
        """The user says which programme a cycle was (also the running one): always learned from."""
        pid = program if program in self.programs else self.program_by_name(name) if name else None
        live = self.detector.cycle
        targets = [c for c in self.cycles if c.get("id") == cycle_id]
        if live is not None and live.get("id") == cycle_id:
            targets.append(live)
        for c in targets:
            c["program"], c["by"], c["score"] = pid, "user", 1.0
        self._drop_empty_programs()
        self._update_quiet()
        self._refresh()
        await self._save()

    async def async_rename(self, pid: str, name: str) -> None:
        if pid in self.programs and name.strip():
            other = next((o for o, p in self.programs.items() if o != pid and (p.get("name") or "").lower() == name.strip().lower()), None)
            if other:
                await self.async_merge(pid, other)
            else:
                self.programs[pid]["name"] = name.strip()
                self._refresh()
                await self._save()

    async def async_merge(self, pid: str, into: str) -> None:
        if pid not in self.programs or into not in self.programs or pid == into:
            return
        for c in self.cycles:
            if c.get("program") == pid:
                c["program"] = into
        self.programs.pop(pid)
        self._refresh()
        await self._save()

    async def async_forget_program(self, pid: str) -> None:
        for c in self.cycles:
            if c.get("program") == pid:
                c["program"], c["by"] = None, None
        self.programs.pop(pid, None)
        self._refresh()
        await self._save()

    async def async_delete_cycle(self, cycle_id: str) -> None:
        self.cycles = [c for c in self.cycles if c.get("id") != cycle_id]
        self._drop_empty_programs()
        self._refresh()
        await self._save()

    def _drop_empty_programs(self) -> None:
        used = {c.get("program") for c in self.cycles}
        live = self.detector.cycle
        if live is not None:
            used.add(live.get("program"))
        for pid in [p for p in self.programs if p not in used and not self.programs[p].get("name")]:
            self.programs.pop(pid)

    # ---------- wear and faults ----------

    def _check_wear(self) -> None:
        found = []
        for pid, cycles in self.learned().items():
            for w in learning.wear(cycles):
                found.append({**w, "program": pid, "at": dt_util.utcnow().isoformat()})
        self.findings = [f for f in self.findings if f["kind"] not in ("heat_slower", "longer")] + found
        self.hub.async_wear_issue(self, found)

    def _finding(self, kind: str, cycle: dict[str, Any], live: bool = False) -> None:
        minutes = round((time.time() - cycle["start"]) / 60)
        finding = {"kind": kind, "at": dt_util.utcnow().isoformat(), "cycle": cycle.get("id"), "minutes": minutes}
        if live:
            finding["live"] = cycle.get("id")
        self.findings = [f for f in self.findings if f.get("cycle") != cycle.get("id") or f["kind"] != kind][-19:]
        self.findings.append(finding)
        text = t(self.hass, f"fault_{kind}", name=self.name, minutes=minutes)
        self.hass.async_create_task(self.hub.async_notify(self, f"⚠️ {self.name}", text), eager_start=False)

    def dismiss(self, index: int) -> None:
        if 0 <= index < len(self.findings):
            self.findings.pop(index)
            self._refresh()
            self._schedule_save(True)

    # ---------- telling ----------

    def details(self, cycle: dict[str, Any], language: str | None = None) -> str:
        parts = [self.program_name(cycle.get("program"), language), duration(self.hass, cycle["duration"], language)]
        if (cost := money(cycle.get("cost"), self.currency)) is not None:
            parts.append(cost)
        return " · ".join(p for p in parts if p)

    async def _notify_done(self, cycle: dict[str, Any]) -> None:
        text = self.details(cycle)
        if self.kind == KIND_WASHER and any(m.kind == KIND_DRYER for m in self.hub.machines.values()):
            text += "\n" + t(self.hass, "move_to_dryer")
        await self.hub.async_notify(
            self, t(self.hass, "done_title", icon=ICONS.get(self.kind, ""), name=self.name), text, emptied=True
        )

    async def _notify_start(self) -> None:
        await self.hub.async_notify(self, t(self.hass, "start_title", icon=ICONS.get(self.kind, ""), name=self.name),
                                    self.program_name(self.live_program) or "")

    def _remind_later(self) -> None:
        minutes = int(self.hub.settings.get(SET_REMIND) or 0)
        if self._remind_cancel:
            self._remind_cancel()
            self._remind_cancel = None
        if minutes <= 0:
            return

        @callback
        def remind(_now: datetime) -> None:
            self._remind_cancel = None
            if self.state == STATE_FINISHED:
                self.hass.async_create_task(self.hub.async_notify(
                    self, t(self.hass, "remind_title", icon=ICONS.get(self.kind, ""), name=self.name),
                    t(self.hass, "remind", minutes=minutes), emptied=True), eager_start=False)

        self._remind_cancel = async_call_later(self.hass, minutes * 60, remind)

    # ---------- for the panel and the card ----------

    def snapshot(self, full: bool = False, language: str | None = None) -> dict[str, Any]:
        c = self.live
        last = self.cycles[-1] if self.cycles else None
        out: dict[str, Any] = {
            "entry_id": self.entry.entry_id, "name": self.name, "kind": self.kind, "state": self.state,
            "power": self.power, "program": self.program_name(self.live_program, language),
            "program_id": self.live_program, "score": self.live_score,
            "finish_time": self.finish_time.isoformat() if self.finish_time else None, "progress": self.progress,
            "started": dt_util.utc_from_timestamp(c["start"]).isoformat() if c else None,
            "live_id": c.get("id") if c else None, "live_wh": round(c["wh"]) if c else None,
            "live_cost": round(c["cost"], 2) if c and c.get("cost") is not None else None,
            "currency": self.currency, "cheap": self.cheap,
            "finished_at": dt_util.utc_from_timestamp(self.detector.finished_at).isoformat()
            if self.detector.finished_at else None,
            "last": self._cycle_out(last, language) if last else None,
            "findings": [
                {**f, "text": t(self.hass, f"wear_{f['kind']}" if f["kind"] in ("heat_slower", "longer") else f"fault_{f['kind']}",
                                language, name=self.name, minutes=f.get("minutes", 0), percent=f.get("percent", 0))}
                for f in self.findings
            ],
            "devices": {k: self.option(k) for k in (CONF_POWER, CONF_ENERGY, CONF_DOOR, CONF_SWITCH)},
        }
        if full:
            month = dt_util.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            this_month = [x for x in self.cycles if x.get("end") and dt_util.utc_from_timestamp(x["end"]) >= month]
            costs = [x["cost"] for x in this_month if x.get("cost") is not None]
            out["history"] = [self._cycle_out(x, language) for x in reversed(self.cycles[-60:])]
            out["programs"] = [
                {"id": pid, "name": self.program_name(pid, language), "named": bool(p.get("name")),
                 "stats": learning.stats(cycles), "count": sum(1 for x in self.cycles if x.get("program") == pid)}
                for pid, p in self.programs.items() for cycles in [self.learned().get(pid, [])]
            ]
            out["month"] = {"count": len(this_month), "kwh": round(sum(x["wh"] for x in this_month) / 1000, 1),
                            "cost": round(sum(costs), 2) if costs else None}
            out["live_curve"] = [round(x, 2) for x in c["curve"]] if c else None
            out["end_quiet"] = round(self.detector.end_quiet_s)
        return out

    def _cycle_out(self, c: dict[str, Any], language: str | None = None) -> dict[str, Any]:
        return {
            "id": c.get("id"), "at": c.get("at"), "start": dt_util.utc_from_timestamp(c["start"]).isoformat(),
            "duration": c.get("duration"), "kwh": round(c["wh"] / 1000, 2), "cost": c.get("cost"),
            "program": self.program_name(c.get("program"), language), "program_id": c.get("program"),
            "by": c.get("by"), "clean": c.get("clean"), "reason": c.get("end_reason"), "resumed": c.get("resumed", 0),
            "curve": _thin(c.get("curve") or []),
        }


def _thin(curve: list[float], points: int = 60) -> list[float]:
    """A small curve for drawing: average W in each of up to 60 slices."""
    if len(curve) <= points:
        return [round(x * 60, 1) for x in curve]
    size = len(curve) / points
    return [round(sum(curve[int(i * size):int((i + 1) * size)]) / max(1, int((i + 1) * size) - int(i * size)) * 60, 1)
            for i in range(points)]


def _watts(state: str, attributes: Any) -> float | None:
    if state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    try:
        value = float(state)
    except ValueError:
        return None
    unit = str(attributes.get("unit_of_measurement") or "W")
    return value * 1000 if unit == "kW" else value

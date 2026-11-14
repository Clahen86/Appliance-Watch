"""What all machines share: settings, notifications, Assist, the panel and the card, finding new machines."""

from __future__ import annotations

import logging
from pathlib import Path
import re
from typing import TYPE_CHECKING, Any

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import SOURCE_INTEGRATION_DISCOVERY
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er, issue_registry as ir
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util, slugify

from .const import (
    ACTION_EMPTIED,
    CONF_KIND,
    CONF_POWER,
    DEFAULT_SETTINGS,
    DOMAIN,
    KIND_OTHER,
    KIND_ORDER, KIND_WORDS,
    SET_FINISH_AFTER_DRY,
    SET_NOTIFY,
    SET_ONLY_HOME,
    STATE_FINISHED,
    STATE_FINISHING,
    STATE_RUNNING,
)
from .texts import TEXT, t

if TYPE_CHECKING:
    from .machine import Machine

_LOGGER = logging.getLogger(__name__)
STATIC = "/appliance_watch_static"
PANEL = "appliance-watch"
SIGNAL_ALL = f"{DOMAIN}_all"
_TITLES = {"da": "Maskiner", "de": "Geräte", "sv": "Maskiner", "nb": "Maskiner", "nl": "Apparaten", "fr": "Appareils"}
SENTENCES = [
    "hvornår er {maskine} færdig",
    "hvornår bliver {maskine} færdig",
    "er {maskine} færdig",
    "hvor lang tid mangler {maskine}",
    "hvor længe mangler {maskine}",
    "hvor længe er der tilbage på {maskine}",
    "when is [the] {maskine} done",
    "when is [the] {maskine} finished",
    "when will [the] {maskine} be done",
    "is [the] {maskine} done",
    "is [the] {maskine} finished",
    "how long is left on [the] {maskine}",
]


def guess_kind(*names: str | None) -> str:
    text = " ".join(n for n in names if n).lower()
    for kind in KIND_ORDER:  # the more particular first: "vaske-tørre" before "vask", "tørretumbler" before "vask"
        if any(w in text for w in KIND_WORDS[kind]):
            return kind
    return KIND_OTHER


class Hub:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.machines: dict[str, Machine] = {}
        self.settings: dict[str, Any] = dict(DEFAULT_SETTINGS)
        self._store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.settings")
        self._unsubs: list[Any] = []

    async def async_setup(self) -> None:
        self.settings = {**DEFAULT_SETTINGS, **(await self._store.async_load() or {})}
        from .speaker import Speaker

        self.speaker = Speaker(self.hass, self)
        folder = Path(__file__).parent / "frontend"
        stamp = await self.hass.async_add_executor_job(_stamp, folder)
        # Files under a new address for every change, so a browser never mixes old and new files.
        self._base = f"{STATIC}/{stamp}"
        await self.hass.http.async_register_static_paths([StaticPathConfig(self._base, str(folder), cache_headers=False)])
        frontend.add_extra_js_url(self.hass, f"{self._base}/card.js?v={stamp}")
        self._stamp = stamp
        self._unsubs.append(self.hass.bus.async_listen("mobile_app_notification_action", self._action))
        if self.hass.state is CoreState.running:
            self.hass.async_create_task(self.async_discover(), eager_start=False)
        else:
            self._unsubs.append(self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, self._started))
        self._register_assist()

    async def _started(self, _event: Event) -> None:
        await self.async_discover()

    async def async_add(self, machine: Machine) -> None:
        first = not self.machines
        self.machines[machine.entry.entry_id] = machine
        if first:
            self.speaker.start()
            await panel_custom.async_register_panel(
                self.hass,
                frontend_url_path=PANEL,
                webcomponent_name="appliance-watch-panel",
                sidebar_title=_TITLES.get(self.hass.config.language.split("-")[0], "Appliances"),
                sidebar_icon="mdi:washing-machine",
                module_url=f"{self._base}/panel.js?v={self._stamp}",
                require_admin=False,
            )

    def remove(self, entry_id: str) -> None:
        self.machines.pop(entry_id, None)
        if not self.machines:
            frontend.async_remove_panel(self.hass, PANEL)
            self.speaker.stop()
        self.async_changed()

    @callback
    def async_changed(self) -> None:
        async_dispatcher_send(self.hass, SIGNAL_ALL)

    async def async_save_settings(self, changes: dict[str, Any]) -> None:
        for key, value in changes.items():
            if key in DEFAULT_SETTINGS:
                self.settings[key] = value
        await self._store.async_save(self.settings)
        for m in self.machines.values():
            m.detector.finish_after_drying = bool(self.settings.get(SET_FINISH_AFTER_DRY))
        self.async_changed()

    # ---------- notifications ----------

    def _is_home(self, service: str) -> bool | None:
        """Whether the phone behind a notify.mobile_app_* service is at home (None: not a phone, or unknown)."""
        if not service.startswith("notify.mobile_app_"):
            return None
        slug = service.removeprefix("notify.mobile_app_")
        devices = dr.async_get(self.hass)
        for entry in er.async_get(self.hass).entities.values():
            if entry.platform != "mobile_app" or entry.domain != "device_tracker" or not entry.device_id:
                continue
            device = devices.async_get(entry.device_id)
            if device and slugify(device.name_by_user or device.name or "") == slug or \
                    device and slugify(device.name or "") == slug:
                state = self.hass.states.get(entry.entity_id)
                return None if state is None else state.state == "home"
        return None

    def targets(self) -> list[str]:
        services = [s for s in self.settings.get(SET_NOTIFY) or [] if s.startswith("notify.")]
        if not self.settings.get(SET_ONLY_HOME):
            return services
        home = {s: self._is_home(s) for s in services}
        if any(v is True for v in home.values()):
            return [s for s, v in home.items() if v is not False]
        return services  # nobody is home: everyone hears it

    def _house_chat_tells(self) -> bool:
        """House Chat (Hus-chat) writes "done" in the family chat itself - then the phones don't get it twice."""
        for entry in self.hass.config_entries.async_loaded_entries("hus_chat"):
            try:
                return bool(entry.runtime_data.get_rules()["machines"]["on"])
            except Exception:  # noqa: BLE001
                return False
        return False

    async def async_notify(self, machine: Machine, title: str, message: str, emptied: bool = False) -> None:
        if self._house_chat_tells():
            return
        for service in self.targets():
            data: dict[str, Any] = {"title": title, "message": message}
            if service.startswith("notify.mobile_app_"):
                extra: dict[str, Any] = {"tag": f"aw_{machine.entry.entry_id}", "group": DOMAIN,
                                         "url": f"/{PANEL}", "clickAction": f"/{PANEL}"}
                if emptied:
                    extra["actions"] = [{"action": ACTION_EMPTIED + machine.entry.entry_id, "title": t(self.hass, "emptied")}]
                data["data"] = extra
            domain, name = service.split(".", 1)
            try:
                await self.hass.services.async_call(domain, name, data, blocking=False)
            except Exception:  # noqa: BLE001 - one phone gone doesn't stop the others
                _LOGGER.warning("Could not notify %s", service, exc_info=True)

    async def async_clear(self, machine: Machine) -> None:
        for service in self.targets():
            if service.startswith("notify.mobile_app_"):
                domain, name = service.split(".", 1)
                try:
                    await self.hass.services.async_call(domain, name, {
                        "message": "clear_notification", "data": {"tag": f"aw_{machine.entry.entry_id}"}}, blocking=False)
                except Exception:  # noqa: BLE001
                    pass

    @callback
    def _action(self, event: Event) -> None:
        action = str(event.data.get("action", ""))
        if action.startswith(ACTION_EMPTIED) and (m := self.machines.get(action.removeprefix(ACTION_EMPTIED))):
            m.async_emptied()

    @callback
    def async_wear_issue(self, machine: Machine, found: list[dict[str, Any]]) -> None:
        issue_id = f"wear_{machine.entry.entry_id}"
        if not found:
            ir.async_delete_issue(self.hass, DOMAIN, issue_id)
            return
        text = " ".join(t(self.hass, f"wear_{f['kind']}", name=machine.name, percent=f["percent"]) for f in found)
        ir.async_create_issue(
            self.hass, DOMAIN, issue_id, is_fixable=False, severity=ir.IssueSeverity.WARNING,
            translation_key="wear", translation_placeholders={"name": machine.name, "text": text},
        )

    # ---------- Assist ----------

    def _register_assist(self) -> None:
        try:
            from homeassistant.components.conversation.agent_manager import get_agent_manager

            self._unsubs.append(get_agent_manager(self.hass).register_trigger(SENTENCES, self._assist))
        except Exception:  # noqa: BLE001 - no Assist: nothing to answer
            _LOGGER.debug("Assist not available", exc_info=True)

    def find(self, text: str) -> Machine | None:
        """The machine someone talks about: by its name, or by what it is ("opvaskeren", "the dryer")."""
        words = text.lower().strip()
        if not self.machines:
            return None
        for m in self.machines.values():
            name = m.name.lower()
            if name in words or words in name or words.rstrip("en").rstrip("n") in name:
                return m
        kind = guess_kind(words)
        same = [m for m in self.machines.values() if m.kind == kind]
        if kind == KIND_OTHER and len(self.machines) == 1:
            return next(iter(self.machines.values()))
        return same[0] if same else None

    async def _assist(self, user_input: Any, result: Any) -> str | None:
        language = getattr(user_input, "language", None)
        slot = result.entities.get("maskine")
        machine = self.find(str(slot.value if slot else ""))
        if machine is None:
            return t(self.hass, "say_none", language)
        return self.say(machine, language)

    def say(self, m: Machine, language: str | None = None) -> str:
        if m.state == STATE_FINISHED:
            return t(self.hass, "say_finished", language, name=m.name)
        if m.state == STATE_FINISHING:
            return t(self.hass, "say_finishing", language, name=m.name)
        if m.state == STATE_RUNNING:
            if m.finish_time is None:
                return t(self.hass, "say_running_unknown", language, name=m.name)
            minutes = round((m.finish_time - dt_util.utcnow()).total_seconds() / 60)
            if minutes <= 2:
                return t(self.hass, "say_running_soon", language, name=m.name)
            when = dt_util.as_local(m.finish_time).strftime("%H:%M")
            return t(self.hass, "say_running", language, name=m.name, minutes=minutes, time=when)
        return t(self.hass, "say_off", language, name=m.name)

    # ---------- finding machines ----------

    def configured(self) -> set[str]:
        return {e.data.get(CONF_POWER) for e in self.hass.config_entries.async_entries(DOMAIN)}

    def candidates(self) -> list[dict[str, str]]:
        """Power sensors that look like a dishwasher, washing machine or dryer, not set up yet."""
        found = []
        devices, entities = dr.async_get(self.hass), er.async_get(self.hass)
        taken = self.configured()
        # A machine already set up under this name: a sensor with the same name is most often its old plug (replaced
        # by a new one), not a second machine.
        names = {e.title.strip().lower() for e in self.hass.config_entries.async_entries(DOMAIN)}
        for state in self.hass.states.async_all("sensor"):
            if state.attributes.get("device_class") != "power" or state.entity_id in taken:
                continue
            if state.state == "unavailable":
                continue  # a dead or removed plug
            if state.attributes.get("unit_of_measurement") not in ("W", "kW"):
                continue
            entry = entities.async_get(state.entity_id)
            if entry is not None and entry.platform in (DOMAIN, "ha_washdata"):
                continue  # our own, or another machine integration's copy of the same reading
            device = devices.async_get(entry.device_id) if entry and entry.device_id else None
            device_name = (device.name_by_user or device.name) if device else None
            kind = guess_kind(state.entity_id, state.attributes.get("friendly_name"), device_name)
            if kind == KIND_OTHER:
                continue
            name = _clean_name(device_name or state.attributes.get("friendly_name") or state.entity_id)
            if name.strip().lower() in names:
                continue
            found.append({"entity_id": state.entity_id, "kind": kind, "name": name})
        # One per device: its main power reading.
        seen, out = set(), []
        for f in sorted(found, key=lambda x: (x["name"], "apparent" in x["entity_id"], "reaktiv" in x["entity_id"])):
            if f["name"] not in seen:
                seen.add(f["name"])
                out.append(f)
        return out

    async def async_discover(self) -> None:
        cands = self.candidates()
        # Suggestions that no longer fit (the plug was removed, or a machine took the name) are taken back.
        keep = {c["entity_id"] for c in cands}
        for flow in self.hass.config_entries.flow.async_progress_by_handler(DOMAIN):
            ctx = flow.get("context") or {}
            if ctx.get("source") == SOURCE_INTEGRATION_DISCOVERY and ctx.get("unique_id") not in keep:
                self.hass.config_entries.flow.async_abort(flow["flow_id"])
        for c in cands:
            await self.hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_INTEGRATION_DISCOVERY},
                data={CONF_POWER: c["entity_id"], CONF_KIND: c["kind"], "name": c["name"]},
            )

    async def async_unload(self) -> None:
        self.speaker.stop()
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()


def _clean_name(name: str) -> str:
    """ "Køkken Opvaskemaskine Elektrisk effekt" -> "Opvaskemaskine". """
    name = re.sub(r"\s*(elektrisk effekt|effekt|power|strøm|leistung|watt)$", "", name, flags=re.I).strip()
    parts = name.split()
    for kind_words in KIND_WORDS.values():
        for i, p in enumerate(parts):
            if any(w in p.lower() for w in kind_words) and len(p) > 4:
                return p[0].upper() + p[1:]
    return name


def _stamp(folder: Path) -> int:
    return int(max(p.stat().st_mtime for p in folder.glob("*.js")))


__all__ = ["Hub", "TEXT", "guess_kind"]

"""The panel's commands. Everyone in the home may look, mark as emptied and say which programme it was;
settings need an admin."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_call_later

from . import ai
from . import prices
from .const import (
    CONF_DOOR,
    CONF_SPEAKER,
    SAY_KINDS,
    SET_QUIET,
    SET_QUIET_FROM,
    SET_QUIET_TO,
    SET_SAY,
    SET_SAY_HOME,
    SET_SPEAKERS,
    SET_TTS,
    CONF_ENERGY,
    CONF_KIND,
    CONF_SWITCH,
    DOMAIN,
    KINDS,
    SET_AI,
    SET_CHEAP,
    SET_FINISH_AFTER_DRY,
    SET_NOTIFY,
    SET_NOTIFY_START,
    SET_ONLY_HOME,
    SET_PRICE,
    SET_PRICE_ADD,
    SET_PRICE_VAT,
    SET_PEAK_ADD,
    SET_PEAK_FROM,
    SET_PEAK_TO,
    SET_REMIND,
)
from .hub import SIGNAL_ALL, Hub
from .machine import Machine

_SKIP_NOTIFY = {"notify", "send_message"}


@callback
def async_setup(hass: HomeAssistant) -> None:
    for command in (ws_machines, ws_subscribe, ws_machine, ws_label, ws_learn, ws_add_program, ws_rename, ws_merge, ws_forget, ws_delete_cycle,
                    ws_emptied, ws_finish, ws_dismiss, ws_settings, ws_save_settings, ws_machine_settings,
                    ws_ai_name, ws_ai_explain, ws_speak_test):
        websocket_api.async_register_command(hass, command)


def _hub(hass: HomeAssistant) -> Hub:
    return hass.data[DOMAIN]


def _machine(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> Machine | None:
    machine = _hub(hass).machines.get(msg["entry_id"])
    if machine is None:
        connection.send_error(msg["id"], "not_found", "No such machine")
    return machine


def _all(hass: HomeAssistant, full: bool = False) -> list[dict[str, Any]]:
    return [m.snapshot(full) for m in sorted(_hub(hass).machines.values(), key=lambda m: m.name.lower())]


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/machines"})
@callback
def ws_machines(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    hub = _hub(hass)
    connection.send_result(msg["id"], {
        "machines": _all(hass), "admin": connection.user.is_admin,
        "has_price": bool(hub.settings.get(SET_PRICE) or prices.energy_pilot(hass)), "has_ai": bool(hub.settings.get(SET_AI)),
        "found": hub.candidates() if connection.user.is_admin else [],
    })


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Live state of all machines, at most every 2 seconds."""
    pending: list[Any] = []

    @callback
    def send(_now: Any = None) -> None:
        pending.clear()
        connection.send_message(websocket_api.event_message(msg["id"], {"machines": _all(hass)}))

    @callback
    def changed() -> None:
        if not pending:
            pending.append(async_call_later(hass, 2, send))

    unsub = async_dispatcher_connect(hass, SIGNAL_ALL, changed)

    @callback
    def stop() -> None:
        unsub()
        for cancel in pending:
            cancel()

    connection.subscriptions[msg["id"]] = stop
    connection.send_result(msg["id"])
    send()


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/machine", vol.Required("entry_id"): str})
@callback
def ws_machine(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (m := _machine(hass, connection, msg)) is not None:
        connection.send_result(msg["id"], m.snapshot(full=True))


def _simple(name: str, fields: dict[Any, Any], run, admin: bool = False):
    schema = {vol.Required("type"): f"{DOMAIN}/{name}", vol.Required("entry_id"): str, **fields}

    @websocket_api.websocket_command(schema)
    @websocket_api.async_response
    async def handler(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
        if admin and not connection.user.is_admin:
            connection.send_error(msg["id"], "unauthorized", "Admin only")
            return
        if (m := _machine(hass, connection, msg)) is None:
            return
        result = await run(hass, m, msg)
        connection.send_result(msg["id"], result if isinstance(result, dict) else m.snapshot(full=True))

    handler.__name__ = f"ws_{name}"
    return handler


async def _label(hass, m: Machine, msg):
    await m.async_label(msg["cycle_id"], name=msg.get("name"), program=msg.get("program"))


async def _learn(hass, m: Machine, msg):
    added = await m.async_learn_history()
    return {**m.snapshot(full=True), "learned": added}


async def _add_program(hass, m: Machine, msg):
    await m.async_add_program(msg["name"])


async def _rename(hass, m: Machine, msg):
    await m.async_rename(msg["program"], msg["name"])


async def _merge(hass, m: Machine, msg):
    await m.async_merge(msg["program"], msg["into"])


async def _forget(hass, m: Machine, msg):
    await m.async_forget_program(msg["program"])


async def _delete_cycle(hass, m: Machine, msg):
    await m.async_delete_cycle(msg["cycle_id"])


async def _emptied(hass, m: Machine, msg):
    m.async_emptied()


async def _finish(hass, m: Machine, msg):
    m.async_force_finish()


async def _dismiss(hass, m: Machine, msg):
    m.dismiss(msg["index"])


async def _machine_settings(hass, m: Machine, msg):
    options = {CONF_KIND: m.kind, **{k: m.option(k) for k in (CONF_DOOR, CONF_ENERGY, CONF_SWITCH, CONF_SPEAKER)}}
    for key in (CONF_KIND, CONF_DOOR, CONF_ENERGY, CONF_SWITCH, CONF_SPEAKER):
        if key in msg:
            options[key] = msg[key]
    options = {k: v for k, v in options.items() if v}
    title = (msg.get("name") or "").strip() or m.entry.title
    hass.config_entries.async_update_entry(m.entry, options=options, title=title)
    return {"saved": True}


async def _ai_name(hass, m: Machine, msg):
    entity_id = _hub(hass).settings.get(SET_AI)
    cycles = m.learned().get(msg["program"]) or [c for c in m.cycles if c.get("program") == msg["program"]]
    if not entity_id or not cycles:
        return {"name": None}
    taken = [m.program_name(p) for p in m.programs if p != msg["program"] and m.programs[p].get("name")]
    return {"name": await ai.name_program(hass, entity_id, m.kind, cycles, taken)}


async def _ai_explain(hass, m: Machine, msg):
    entity_id = _hub(hass).settings.get(SET_AI)
    cycle = next((c for c in m.cycles if c.get("id") == msg["cycle_id"]), None)
    if not entity_id or cycle is None:
        return {"text": None}
    finding = next((f["kind"] for f in m.findings if f.get("cycle") == cycle.get("id")), None)
    return {"text": await ai.explain(hass, entity_id, m.kind, cycle, m.program_stats(cycle.get("program")), finding)}


ws_label = _simple("label", {vol.Required("cycle_id"): str, vol.Optional("name"): str, vol.Optional("program"): str}, _label)
ws_learn = _simple("learn_history", {}, _learn, admin=True)
ws_add_program = _simple("add_program", {vol.Required("name"): str}, _add_program)
ws_rename = _simple("rename_program", {vol.Required("program"): str, vol.Required("name"): str}, _rename)
ws_merge = _simple("merge_program", {vol.Required("program"): str, vol.Required("into"): str}, _merge)
ws_forget = _simple("forget_program", {vol.Required("program"): str}, _forget)
ws_delete_cycle = _simple("delete_cycle", {vol.Required("cycle_id"): str}, _delete_cycle)
ws_emptied = _simple("emptied", {}, _emptied)
ws_finish = _simple("finish", {}, _finish)
ws_dismiss = _simple("dismiss", {vol.Required("index"): int}, _dismiss)
ws_machine_settings = _simple("machine_settings", {
    vol.Optional("name"): str, vol.Optional(CONF_KIND): vol.In(KINDS), vol.Optional(CONF_DOOR): vol.Any(None, cv.entity_id),
    vol.Optional(CONF_ENERGY): vol.Any(None, cv.entity_id), vol.Optional(CONF_SWITCH): vol.Any(None, cv.entity_id),
    vol.Optional(CONF_SPEAKER): vol.Any(None, cv.entity_domain("media_player")),
}, _machine_settings, admin=True)
ws_ai_name = _simple("ai_name", {vol.Required("program"): str}, _ai_name)
ws_ai_explain = _simple("ai_explain", {vol.Required("cycle_id"): str}, _ai_explain)


def _price_sensors(hass: HomeAssistant) -> list[dict[str, str]]:
    out = []
    for state in hass.states.async_all("sensor"):
        unit = str(state.attributes.get("unit_of_measurement") or "")
        if unit.lower().endswith(("/kwh", "/mwh")):
            forecast = any(isinstance(state.attributes.get(k), list) for k in prices.LIST_KEYS)
            out.append({"entity_id": state.entity_id, "name": state.attributes.get("friendly_name") or state.entity_id,
                        "forecast": forecast})
    return sorted(out, key=lambda x: (not x["forecast"], x["name"].lower()))


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/settings"})
@callback
def ws_settings(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    hub = _hub(hass)
    current = list(hub.settings.get(SET_NOTIFY) or [])
    notify = {f"notify.{n}" for n in hass.services.async_services_for_domain("notify") if n not in _SKIP_NOTIFY}
    connection.send_result(msg["id"], {
        "settings": hub.settings,
        "notify_services": sorted(notify | set(current)),
        "price_sensors": _price_sensors(hass),
        "energy_pilot": prices.energy_pilot(hass) is not None,  # its total price can be chosen
        "spot": prices.is_spot_only(hass, hub.settings.get(SET_PRICE)),  # the extras belong on top
        "ai_tasks": sorted(s.entity_id for s in hass.states.async_all("ai_task")),
        "speakers": sorted(({"entity_id": s.entity_id, "name": s.attributes.get("friendly_name") or s.entity_id,
                              "off": s.state in ("unavailable", "off")}
                             for s in hass.states.async_all("media_player")
                             if int(s.attributes.get("supported_features") or 0) & 512), key=lambda x: x["name"].lower()),
        "voices": sorted(({"entity_id": s.entity_id, "name": s.attributes.get("friendly_name") or s.entity_id}
                          for s in hass.states.async_all("tts")), key=lambda x: x["name"].lower()),
    })


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_settings",
    vol.Optional(SET_NOTIFY): [cv.string],
    vol.Optional(SET_ONLY_HOME): cv.boolean,
    vol.Optional(SET_REMIND): vol.All(vol.Coerce(int), vol.Range(min=0, max=720)),
    vol.Optional(SET_PRICE): vol.Any(None, "energy_pilot", cv.entity_id),
    vol.Optional(SET_PRICE_ADD): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=-100, max=100000))),
    vol.Optional(SET_PRICE_VAT): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=100))),
    vol.Optional(SET_PEAK_ADD): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=-100, max=100000))),
    vol.Optional(SET_PEAK_FROM): vol.Match(r"^\d{1,2}:\d{2}$"),
    vol.Optional(SET_PEAK_TO): vol.Match(r"^\d{1,2}:\d{2}$"),
    vol.Optional(SET_AI): vol.Any(None, cv.entity_domain("ai_task")),
    vol.Optional(SET_CHEAP): vol.All(vol.Coerce(float), vol.Range(min=0, max=100)),
    vol.Optional(SET_NOTIFY_START): cv.boolean,
    vol.Optional(SET_FINISH_AFTER_DRY): cv.boolean,
    vol.Optional(SET_SPEAKERS): [cv.entity_domain("media_player")],
    vol.Optional(SET_TTS): vol.Any(None, cv.entity_domain("tts")),
    vol.Optional(SET_SAY): {vol.In(SAY_KINDS): cv.boolean},
    vol.Optional(SET_SAY_HOME): cv.boolean,
    vol.Optional(SET_QUIET): cv.boolean,
    vol.Optional(SET_QUIET_FROM): vol.Match(r"^\d{1,2}:\d{2}$"),
    vol.Optional(SET_QUIET_TO): vol.Match(r"^\d{1,2}:\d{2}$"),
})
@websocket_api.async_response
async def ws_save_settings(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    await _hub(hass).async_save_settings({k: v for k, v in msg.items() if k not in ("id", "type")})
    connection.send_result(msg["id"], {"saved": True})


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/speak_test", vol.Optional("speakers"): [cv.entity_domain("media_player")],
})
@websocket_api.async_response
async def ws_speak_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Say a sample on the chosen speakers, now - so you hear the voice and the volume."""
    from .texts import t

    hub = _hub(hass)
    machine = next(iter(sorted(hub.machines.values(), key=lambda m: m.kind != "dishwasher")), None)
    name = machine.name if machine else t(hass, "program")
    said = await hub.speaker.async_say(None, "done", t(hass, "say_test", name=name), test=True,
                                       players=msg.get("speakers") or list(hub.settings.get(SET_SPEAKERS) or []))
    connection.send_result(msg["id"], {"said": said})

"""Setting up a machine, a whole cycle through Home Assistant, the panel's commands, Assist."""

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
    async_mock_service,
)

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.setup import async_setup_component

from custom_components.appliance_watch.const import DOMAIN, EVENT_FINISHED

POWER = "sensor.opvaskemaskine_effekt"


async def _setup(hass: HomeAssistant, **data) -> MockConfigEntry:
    hass.states.async_set(POWER, "0.3", {"device_class": "power", "unit_of_measurement": "W",
                                         "friendly_name": "Køkken Opvaskemaskine Effekt"})
    hass.states.async_set("sensor.elpris", "2.0", {"unit_of_measurement": "kr/kWh"})
    entry = MockConfigEntry(domain=DOMAIN, title="Opvaskemaskine", unique_id=POWER,
                            data={"power_sensor": POWER, "kind": "dishwasher", **data})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _run(hass, freezer: FrozenDateTimeFactory, watts: float, minutes: float) -> None:
    hass.states.async_set(POWER, str(watts), {"device_class": "power", "unit_of_measurement": "W"})
    await hass.async_block_till_done()
    for _ in range(int(minutes * 2)):
        freezer.tick(timedelta(seconds=30))
        async_fire_time_changed(hass)
        await hass.async_block_till_done()


async def _cycle(hass, freezer) -> None:
    await _run(hass, freezer, 1900, 15)
    await _run(hass, freezer, 50, 10)
    await _run(hass, freezer, 8, 3)  # a pause
    await _run(hass, freezer, 1900, 15)
    await _run(hass, freezer, 50, 5)
    await _run(hass, freezer, 12, 14)  # drying: done well before it ends


def _fake_cycle(machine, start: float) -> None:
    """A finished cycle in the past, fed straight to the machine (no clock to move)."""
    t = start
    for w, minutes in ((1900, 15), (50, 10), (1900, 15), (50, 5), (12, 14)):
        machine._handle(machine.detector.sample(t, w))
        for _ in range(minutes * 2):
            t += 30
            machine._handle(machine.detector.tick(t))
    machine._refresh()


async def test_config_flow(hass: HomeAssistant) -> None:
    hass.states.async_set(POWER, "0.3", {"device_class": "power", "unit_of_measurement": "W",
                                         "friendly_name": "Køkken Opvaskemaskine Effekt"})
    assert await async_setup_component(hass, DOMAIN, {})
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    assert "Opvaskemaskine" in result["description_placeholders"]["found"]
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"power_sensor": POWER})
    assert result["step_id"] == "details"
    schema = {str(k): k for k in result["data_schema"].schema}
    assert schema["name"].default() == "Opvaskemaskine"
    assert schema["kind"].default() == "dishwasher"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"name": "Opvasker", "kind": "dishwasher"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {"power_sensor": POWER, "kind": "dishwasher"}


async def test_discovery(hass: HomeAssistant) -> None:
    hass.states.async_set(POWER, "0.3", {"device_class": "power", "unit_of_measurement": "W",
                                         "friendly_name": "Køkken Opvaskemaskine Effekt"})
    hass.states.async_set("sensor.tv_effekt", "40", {"device_class": "power", "unit_of_measurement": "W"})
    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    flows = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
    assert [f["context"]["unique_id"] for f in flows] == [POWER]


async def test_a_whole_cycle(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    notify = async_mock_service(hass, "notify", "mobile_app_telefon")
    entry = await _setup(hass)
    hub = hass.data[DOMAIN]
    await hub.async_save_settings({"notify": ["notify.mobile_app_telefon"], "price_sensor": "sensor.elpris",
                                   "only_home": False})
    finished = []
    hass.bus.async_listen(EVENT_FINISHED, finished.append)
    status = "sensor.opvaskemaskine_status"
    await _run(hass, freezer, 1900, 3)
    assert hass.states.get(status).state == "running"
    assert hass.states.get("binary_sensor.opvaskemaskine_running").state == "on"
    await _cycle(hass, freezer)
    assert hass.states.get(status).state == "finished"
    assert len(finished) == 1
    data = finished[0].data
    assert data["program"] == "Program 1"
    assert 0.9 < data["energy_kwh"] < 1.3
    assert data["cost"] == round(data["energy_kwh"] * 2, 2) or abs(data["cost"] - data["energy_kwh"] * 2) < 0.05
    assert len(notify) == 1
    call = notify[0].data
    assert call["title"] == "🍽️ Opvaskemaskine er færdig" or call["title"].endswith("is done")
    assert call["data"]["actions"][0]["action"].endswith(entry.entry_id)
    assert hass.states.get("sensor.opvaskemaskine_last_cycle_cost").state not in ("unknown", "unavailable")

    # Tapping "Emptied" on the phone
    hass.bus.async_fire("mobile_app_notification_action", {"action": notify[0].data["data"]["actions"][0]["action"]})
    await hass.async_block_till_done()
    assert hass.states.get(status).state == "off"


async def test_second_cycle_knows_the_programme(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    entry = await _setup(hass)
    machine = entry.runtime_data
    await _run(hass, freezer, 1900, 3)
    await _cycle(hass, freezer)
    await machine.async_label(machine.cycles[-1]["id"], name="Eco 50°")
    machine.async_emptied()
    await _run(hass, freezer, 0.3, 30)
    await _run(hass, freezer, 1900, 3)
    await _run(hass, freezer, 1900, 15)
    await _run(hass, freezer, 50, 5)
    assert machine.live_program is not None
    assert machine.program_name(machine.live_program) == "Eco 50°"
    assert machine.finish_time is not None
    assert hass.states.get("sensor.opvaskemaskine_program").state == "Eco 50°"
    # It learned the 3 min pause: done much sooner than the 10 min it waits for an unknown programme
    assert machine.detector.end_quiet_s < 600


async def test_panel_commands(hass: HomeAssistant, hass_ws_client) -> None:
    import time

    entry = await _setup(hass)
    ws = await hass_ws_client(hass)
    _fake_cycle(entry.runtime_data, time.time() + 10)
    await hass.async_block_till_done()
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/machines"})
    msg = await ws.receive_json()
    assert msg["success"]
    assert msg["result"]["machines"][0]["state"] == "finished"
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/machine", "entry_id": entry.entry_id})
    full = (await ws.receive_json())["result"]
    assert len(full["history"]) == 1 and full["programs"][0]["name"] == "Program 1"
    pid, cid = full["programs"][0]["id"], full["history"][0]["id"]
    await ws.send_json({"id": 3, "type": f"{DOMAIN}/rename_program", "entry_id": entry.entry_id, "program": pid,
                        "name": "Hurtig"})
    assert (await ws.receive_json())["result"]["programs"][0]["name"] == "Hurtig"
    await ws.send_json({"id": 4, "type": f"{DOMAIN}/label", "entry_id": entry.entry_id, "cycle_id": cid,
                        "name": "Intensiv 70°"})
    res = (await ws.receive_json())["result"]
    assert res["history"][0]["program"] == "Intensiv 70°" and res["history"][0]["by"] == "user"
    await ws.send_json({"id": 5, "type": f"{DOMAIN}/emptied", "entry_id": entry.entry_id})
    assert (await ws.receive_json())["result"]["state"] == "off"
    await ws.send_json({"id": 6, "type": f"{DOMAIN}/settings"})
    assert "notify_services" in (await ws.receive_json())["result"]
    await ws.send_json({"id": 7, "type": f"{DOMAIN}/save_settings", "remind_minutes": 30})
    assert (await ws.receive_json())["success"]
    assert hass.data[DOMAIN].settings["remind_minutes"] == 30
    await ws.send_json({"id": 10, "type": f"{DOMAIN}/add_program", "entry_id": entry.entry_id, "name": "Skyl"})
    assert "Skyl" in [p["name"] for p in (await ws.receive_json())["result"]["programs"]]
    await ws.send_json({"id": 11, "type": f"{DOMAIN}/subscribe"})
    assert (await ws.receive_json())["success"]
    event = await ws.receive_json()
    assert event["event"]["machines"][0]["name"] == "Opvaskemaskine"


async def test_assist(hass: HomeAssistant, freezer) -> None:
    entry = await _setup(hass)
    hub = hass.data[DOMAIN]
    assert hub.find("opvaskeren") is entry.runtime_data
    assert hub.find("the dishwasher") is entry.runtime_data
    assert hub.say(entry.runtime_data, "da") == "Opvaskemaskine kører ikke."
    await _run(hass, freezer, 1900, 3)
    assert "kører" in hub.say(entry.runtime_data, "da")


async def test_door_sensor(hass: HomeAssistant, freezer) -> None:
    hass.states.async_set("binary_sensor.opvask_dor", "off", {"device_class": "door"})
    entry = await _setup(hass, door_sensor="binary_sensor.opvask_dor")
    await _run(hass, freezer, 1900, 15)
    await _run(hass, freezer, 12, 1)
    hass.states.async_set("binary_sensor.opvask_dor", "on", {"device_class": "door"})
    await hass.async_block_till_done()
    assert entry.runtime_data.state == "off"
    assert len(entry.runtime_data.cycles) == 1
    assert entry.runtime_data.cycles[0]["end_reason"] == "door"


async def test_unload(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert not hass.data[DOMAIN].machines


async def test_learns_from_history(hass: HomeAssistant) -> None:
    """A new machine goes through the power readings Home Assistant already has (the real dishwasher's)."""
    from datetime import datetime, timezone
    from unittest.mock import MagicMock, patch

    from homeassistant.core import State

    from .conftest import readings

    rows = [State(POWER, "unavailable" if w is None else str(w),
                  last_changed=datetime.fromtimestamp(t, timezone.utc), last_updated=datetime.fromtimestamp(t, timezone.utc))
            for t, w in readings("dishwasher")]
    instance = MagicMock()
    instance.async_add_executor_job = hass.async_add_executor_job
    hass.config.components.add("recorder")
    with patch("homeassistant.components.recorder.get_instance", return_value=instance), \
         patch("homeassistant.components.recorder.history.state_changes_during_period", return_value={POWER: rows}):
        entry = await _setup(hass)
        await hass.async_block_till_done()
    machine = entry.runtime_data
    assert machine.imported
    assert len(machine.cycles) == 6
    assert all(c["by"] == "history" and c["clean"] for c in machine.cycles)
    # The four 50-minute runs are one programme, the two long ones others
    assert max(sum(1 for c in machine.cycles if c["program"] == p) for p in machine.programs) >= 4


async def test_speakers(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """Done, nearly done and emptied are said as announcements; nothing at night; each can be switched off."""
    from unittest.mock import patch

    await hass.config.async_set_time_zone("Europe/Copenhagen")
    freezer.move_to("2026-11-06 12:00:00+01:00")
    play = async_mock_service(hass, "media_player", "play_media")
    entry = await _setup(hass)
    hub = hass.data[DOMAIN]
    await hub.async_save_settings({"speakers": ["media_player.kokken"], "say_only_home": False,
                                   "say": {"done": True, "soon": True, "remind": True, "dryer": True, "emptied": True, "started": False}})
    with patch("custom_components.appliance_watch.speaker._media_id", side_effect=lambda h, text, engine: f"tts:{text}"):
        await _run(hass, freezer, 1900, 3)
        await _cycle(hass, freezer)
        said = [c.data["media_content_id"] for c in play]
        assert said and said[-1].startswith("tts:Opvaskemaskine is done")
        assert all(c.data["announce"] and c.data["entity_id"] == ["media_player.kokken"] for c in play)
        await hass.services.async_call(DOMAIN, "emptied", {"entity_id": "sensor.opvaskemaskine_status"}, blocking=True)
        await hass.async_block_till_done()
        assert play[-1].data["media_content_id"] == "tts:Thank you! Opvaskemaskine is ready again."
        n = len(play)
        # At night: quiet, said in the morning instead
        freezer.move_to("2026-11-06 23:00:00+01:00")
        await _run(hass, freezer, 0.3, 30)
        await _run(hass, freezer, 1900, 3)
        await _cycle(hass, freezer)
        assert len(play) == n
        assert entry.entry_id in hub.speaker.morning
        # Switched off: nothing
        await hub.async_save_settings({"say": {"done": False}})
        assert not hub.speaker.wants("done")

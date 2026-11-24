"""Pushes without bombarding: quiet hours, one reminder, "still running" only after a "done", alarms at once."""

import asyncio
from datetime import timedelta
from unittest.mock import MagicMock, patch

from freezegun.api import FrozenDateTimeFactory
from pytest_homeassistant_custom_component.common import async_fire_time_changed, async_mock_service

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.appliance_watch import prices
from custom_components.appliance_watch.const import DOMAIN

from .test_init import POWER, _cycle, _fake_cycle, _run, _setup


async def _phone(hass: HomeAssistant, freezer: FrozenDateTimeFactory, when: str, **settings):
    await hass.config.async_set_time_zone("Europe/Copenhagen")
    freezer.move_to(when)
    notify = async_mock_service(hass, "notify", "mobile_app_telefon")
    entry = await _setup(hass)
    await hass.data[DOMAIN].async_save_settings({"notify": ["notify.mobile_app_telefon"], "only_home": False, **settings})
    return entry, notify


async def _to(hass, freezer, when: str) -> None:
    freezer.move_to(when)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_done_at_night_waits_for_the_morning(hass: HomeAssistant, freezer, hass_storage) -> None:
    entry, notify = await _phone(hass, freezer, "2026-11-06 23:00:00+01:00", notify_start=True)
    machine = entry.runtime_data
    await _run(hass, freezer, 1900, 3)
    await _cycle(hass, freezer)
    assert machine.state == "finished"
    assert notify == []  # neither "started" nor "done" at night
    assert machine.held["kind"] == "done"
    await hass.async_block_till_done()
    assert hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]["held"]["kind"] == "done"  # kept over a restart
    await _to(hass, freezer, "2026-11-07 06:59:05+01:00")
    assert notify == []
    await _to(hass, freezer, "2026-11-07 07:00:05+01:00")
    assert len(notify) == 1 and "Opvaskemaskine" in notify[0].data["title"]
    assert notify[0].data["data"]["tag"] == f"aw_{entry.entry_id}"
    assert machine.held is None and machine.notified_done is not None
    await _to(hass, freezer, "2026-11-07 07:01:05+01:00")
    assert len(notify) == 1  # only once


async def test_emptied_in_the_night_sends_nothing_in_the_morning(hass: HomeAssistant, freezer) -> None:
    entry, notify = await _phone(hass, freezer, "2026-11-06 23:00:00+01:00", remind_minutes=0)
    machine = entry.runtime_data
    await _run(hass, freezer, 1900, 3)
    await _cycle(hass, freezer)
    machine.async_emptied()
    await hass.async_block_till_done()
    await _to(hass, freezer, "2026-11-07 07:00:05+01:00")
    assert [c for c in notify if c.data["message"] != "clear_notification"] == []


async def test_still_running_only_after_a_done_that_was_sent(hass: HomeAssistant, freezer) -> None:
    entry, notify = await _phone(hass, freezer, "2026-11-06 23:00:00+01:00")
    machine = entry.runtime_data
    await _run(hass, freezer, 1900, 3)
    await _cycle(hass, freezer)
    assert machine.held is not None
    machine._handle([("resumed", machine.detector.cycle)])
    await hass.async_block_till_done()
    assert notify == [] and machine.held is None  # "done" never went out: nothing to take back


async def test_alarms_go_at_once_and_ok_only_after_an_alarm(hass: HomeAssistant, freezer) -> None:
    entry, notify = await _phone(hass, freezer, "2026-11-06 23:30:00+01:00")
    machine = entry.runtime_data
    machine._watched([("ok", "stopped")])  # no alarm was sent: no "works again"
    await hass.async_block_till_done()
    assert notify == []
    machine._watched([("alert", "stopped")])
    await hass.async_block_till_done()
    assert len(notify) == 1  # in the quiet hours too
    machine._watched([("ok", "stopped")])
    await hass.async_block_till_done()
    assert len(notify) == 2 and notify[1].data["data"]["tag"] == notify[0].data["data"]["tag"]


async def test_one_reminder_per_cycle(hass: HomeAssistant, freezer) -> None:
    entry, notify = await _phone(hass, freezer, "2026-11-06 12:00:00+01:00", remind_minutes=5)
    machine = entry.runtime_data
    await _run(hass, freezer, 1900, 3)
    await _cycle(hass, freezer)
    assert len(notify) == 1
    await _run(hass, freezer, 0.3, 6)
    assert len(notify) == 2 and "venter" in notify[1].data["title"] or "waiting" in notify[1].data["title"]
    machine._remind_later()  # finished again (it went on): no second reminder for the same cycle
    await _run(hass, freezer, 0.3, 6)
    assert len(notify) == 2


async def test_lost_reading_is_no_done(hass: HomeAssistant, freezer) -> None:
    entry, notify = await _phone(hass, freezer, "2026-11-06 12:00:00+01:00")
    machine = entry.runtime_data
    await _run(hass, freezer, 1900, 10)
    hass.states.async_set(POWER, "unavailable")
    await hass.async_block_till_done()
    for _ in range(70):
        freezer.tick(timedelta(seconds=30))
        async_fire_time_changed(hass)
        await hass.async_block_till_done()
    assert machine.state == "finished" and machine.cycles[-1]["end_reason"] == "power_lost"
    assert len(notify) == 1 and notify[0].data["title"].startswith("⚠️")  # the lost-reading notice only
    await _run(hass, freezer, 1900, 8)  # it was running all along
    assert machine.state == "running"
    assert len(notify) == 1 and not machine.cycles
    assert not any(f["kind"] == "power_lost" for f in machine.findings)


async def test_prices_are_not_worked_out_on_every_reading(hass: HomeAssistant) -> None:
    import time

    entry = await _setup(hass)
    machine = entry.runtime_data
    now = dt_util.utcnow().replace(minute=0, second=0, microsecond=0)
    rows = [{"start": (now + timedelta(minutes=15 * i)).isoformat(), "price": 3.0 if i < 20 else 1.0} for i in range(96)]
    hass.states.async_set("sensor.elpris", "3.0", {"unit_of_measurement": "kr/kWh", "prices": rows})
    await hass.data[DOMAIN].async_save_settings({"price_sensor": "sensor.elpris", "cheap_saving": 0})
    _fake_cycle(machine, time.time() + 10)
    machine.async_emptied()
    assert machine.cycles and machine.state == "off"
    calls = {"forecast": 0, "cheapest": 0}
    forecast, cheapest = prices.forecast, prices.cheapest

    def count(name, fn):
        def inner(*args, **kwargs):
            calls[name] += 1
            return fn(*args, **kwargs)
        return inner

    with patch.object(prices, "forecast", count("forecast", forecast)), \
            patch.object(prices, "cheapest", count("cheapest", cheapest)):
        for i in range(30):  # standby readings, seconds apart
            hass.states.async_set(POWER, str(0.3 + i / 100), {"device_class": "power", "unit_of_measurement": "W"})
            await hass.async_block_till_done()
        assert calls["forecast"] <= 1 and calls["cheapest"] <= 1
        machine._tick(None)  # on the tick it is worked out (once)
        assert machine.cheap is not None and machine.cheap["saving"] > 0


async def test_learning_from_history_stops_with_the_machine(hass: HomeAssistant, hass_storage) -> None:
    """Removed while it still goes through the history: it mustn't save a store for a machine that is gone."""
    gate = asyncio.Event()

    async def slow(fn, *args):
        await gate.wait()
        return {POWER: []}

    instance = MagicMock()
    instance.async_add_executor_job = slow
    hass.config.components.add("recorder")
    with patch("homeassistant.components.recorder.get_instance", return_value=instance):
        entry = await _setup(hass)
        task = entry.runtime_data._learn_task
        await hass.config_entries.async_remove(entry.entry_id)
        await hass.async_block_till_done()
        gate.set()
        await asyncio.sleep(0)
        await hass.async_block_till_done()
    assert task.cancelled() or task.done()
    assert f"{DOMAIN}.{entry.entry_id}" not in hass_storage

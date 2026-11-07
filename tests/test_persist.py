from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from homeassistant.core import State

from .conftest import readings
from .test_init import POWER, _setup


async def test_persist(hass, hass_storage):
    rows = [State(POWER, "unavailable" if w is None else str(w), last_changed=datetime.fromtimestamp(t, timezone.utc),
                  last_updated=datetime.fromtimestamp(t, timezone.utc)) for t, w in readings("dishwasher")]
    instance = MagicMock()
    instance.async_add_executor_job = hass.async_add_executor_job
    hass.config.components.add("recorder")
    with patch("homeassistant.components.recorder.get_instance", return_value=instance), \
         patch("homeassistant.components.recorder.history.state_changes_during_period", return_value={POWER: rows}):
        entry = await _setup(hass)
        await hass.async_block_till_done()
        assert len(entry.runtime_data.cycles) == 6
        assert await hass.config_entries.async_reload(entry.entry_id)
        await hass.async_block_till_done()

        assert len(entry.runtime_data.cycles) == 6
    from homeassistant.const import EVENT_HOMEASSISTANT_STOP
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STOP)
    await hass.async_block_till_done()
    await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    data = hass_storage[f"appliance_watch.{entry.entry_id}"]["data"]
    assert len(data["cycles"]) == 6

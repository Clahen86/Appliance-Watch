"""Common base for a machine's entities."""

from __future__ import annotations

from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, SIGNAL_UPDATE
from .machine import Machine

MODELS = {"dishwasher": "Dishwasher", "washer": "Washing machine", "dryer": "Dryer", "other": "Appliance"}


class MachineEntity(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, machine: Machine, key: str) -> None:
        self.machine = machine
        self._attr_translation_key = key
        self._attr_unique_id = f"{machine.entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, machine.entry.entry_id)}, name=machine.name,
            manufacturer="Appliance Watch", model=MODELS.get(machine.kind, "Appliance"),
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(
            self.hass, SIGNAL_UPDATE.format(self.machine.entry.entry_id), self._update))

    @callback
    def _update(self) -> None:
        self.async_write_ha_state()

"""Emptied: the machine is ready for the next load (when there's no door sensor to tell)."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import STATE_FINISHED
from .entity import MachineEntity


async def async_setup_entry(hass: HomeAssistant, entry, add: AddConfigEntryEntitiesCallback) -> None:
    add([EmptiedButton(entry.runtime_data)])


class EmptiedButton(MachineEntity, ButtonEntity):
    def __init__(self, machine) -> None:
        super().__init__(machine, "emptied")

    @property
    def available(self) -> bool:
        return self.machine.state == STATE_FINISHED

    async def async_press(self) -> None:
        self.machine.async_emptied()

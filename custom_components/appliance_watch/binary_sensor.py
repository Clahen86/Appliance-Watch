"""Running, and something wrong (a fault or wear)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import STATE_FINISHING, STATE_RUNNING
from .entity import MachineEntity


async def async_setup_entry(hass: HomeAssistant, entry, add: AddConfigEntryEntitiesCallback) -> None:
    m = entry.runtime_data
    add([RunningSensor(m), ProblemSensor(m)])


class RunningSensor(MachineEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.RUNNING

    def __init__(self, machine) -> None:
        super().__init__(machine, "running")

    @property
    def is_on(self) -> bool:
        return self.machine.state in (STATE_RUNNING, STATE_FINISHING)


class ProblemSensor(MachineEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, machine) -> None:
        super().__init__(machine, "problem")

    @property
    def is_on(self) -> bool:
        return bool(self.machine.findings)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"findings": [f["text"] for f in self.machine.snapshot()["findings"]]}

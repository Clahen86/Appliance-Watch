"""Sensors: status (with everything the card needs), programme, done at, time left, progress, last cycle."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import PERCENTAGE, UnitOfEnergy, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import CONF_POWER, STATES
from .entity import MachineEntity


async def async_setup_entry(hass: HomeAssistant, entry, add: AddConfigEntryEntitiesCallback) -> None:
    m = entry.runtime_data
    add([StatusSensor(m), ProgramSensor(m), FinishSensor(m), RemainingSensor(m), ProgressSensor(m),
         LastEnergySensor(m), LastCostSensor(m)])


class StatusSensor(MachineEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = STATES
    _unrecorded_attributes = frozenset({"cheap", "findings", "last", "power", "score", "live_wh", "live_cost", "month",
                                        "today", "spark"})

    def __init__(self, machine) -> None:
        super().__init__(machine, "status")

    @property
    def native_value(self) -> str:
        return self.machine.state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        s = self.machine.snapshot()
        s["power_sensor"] = (s.get("devices") or {}).get(CONF_POWER)  # so Energy Pilot finds the same machine
        s["typical"] = self.machine.typical()
        last = s.pop("last")
        for key in ("devices", "state", "live_id", "spark", "today"):
            s.pop(key, None)
        s["findings"] = [f["text"] for f in s["findings"]]
        if last:
            s["last"] = {k: last.get(k) for k in ("at", "duration", "kwh", "cost", "program", "saved")}
        return s


class ProgramSensor(MachineEntity, SensorEntity):
    def __init__(self, machine) -> None:
        super().__init__(machine, "program")

    @property
    def native_value(self) -> str | None:
        m = self.machine
        if m.live is not None:
            return m.program_name(m.live_program)
        return m.program_name(m.cycles[-1].get("program")) if m.cycles else None


class FinishSensor(MachineEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, machine) -> None:
        super().__init__(machine, "finish_time")

    @property
    def native_value(self):
        return self.machine.finish_time


class RemainingSensor(MachineEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.MINUTES

    def __init__(self, machine) -> None:
        super().__init__(machine, "remaining")

    @property
    def native_value(self) -> int | None:
        f = self.machine.finish_time
        return max(0, round((f - dt_util.utcnow()).total_seconds() / 60)) if f else None


class ProgressSensor(MachineEntity, SensorEntity):
    _attr_native_unit_of_measurement = PERCENTAGE

    def __init__(self, machine) -> None:
        super().__init__(machine, "progress")

    @property
    def native_value(self) -> float | None:
        return self.machine.progress


class LastEnergySensor(MachineEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENERGY
    _attr_native_unit_of_measurement = UnitOfEnergy.KILO_WATT_HOUR
    _attr_suggested_display_precision = 2

    def __init__(self, machine) -> None:
        super().__init__(machine, "last_energy")

    @property
    def native_value(self) -> float | None:
        c = self.machine.cycles[-1] if self.machine.cycles else None
        return round(c["wh"] / 1000, 3) if c else None


class LastCostSensor(MachineEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.MONETARY
    _attr_suggested_display_precision = 2

    def __init__(self, machine) -> None:
        super().__init__(machine, "last_cost")

    @property
    def native_unit_of_measurement(self) -> str | None:
        return self.machine.currency

    @property
    def native_value(self) -> float | None:
        c = self.machine.cycles[-1] if self.machine.cycles else None
        return c.get("cost") if c else None

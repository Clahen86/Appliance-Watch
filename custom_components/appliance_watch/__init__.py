"""Appliance Watch: knows when your dishwasher, washing machine and dryer are really done."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv, entity_registry as er
from homeassistant.helpers.typing import ConfigType
import voluptuous as vol

from . import websocket
from .const import DOMAIN
from .hub import Hub
from .machine import Machine

PLATFORMS = [Platform.BINARY_SENSOR, Platform.BUTTON, Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type ApplianceConfigEntry = ConfigEntry[Machine]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    hub = Hub(hass)
    hass.data[DOMAIN] = hub
    await hub.async_setup()
    websocket.async_setup(hass)

    def machine_of(call: ServiceCall) -> Machine:
        entity_id = call.data["entity_id"]
        entry = er.async_get(hass).async_get(entity_id)
        machine = hub.machines.get(entry.config_entry_id) if entry and entry.config_entry_id else None
        if machine is None:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_a_machine")
        return machine

    async def set_program(call: ServiceCall) -> None:
        machine = machine_of(call)
        cycle = machine.live or (machine.cycles[-1] if machine.cycles else None)
        if cycle is None:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="no_cycle")
        await machine.async_label(cycle["id"], name=call.data["program"])

    async def emptied(call: ServiceCall) -> None:
        machine_of(call).async_emptied()

    target = vol.Schema({vol.Required("entity_id"): cv.entity_id})
    hass.services.async_register(DOMAIN, "set_program", set_program,
                                 target.extend({vol.Required("program"): cv.string}))
    hass.services.async_register(DOMAIN, "emptied", emptied, target)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ApplianceConfigEntry) -> bool:
    hub: Hub = hass.data[DOMAIN]
    machine = Machine(hass, entry, hub)
    entry.runtime_data = machine
    await machine.async_start()
    await hub.async_add(machine)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_changed))
    return True


async def _changed(hass: HomeAssistant, entry: ApplianceConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ApplianceConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        await entry.runtime_data.async_stop()
        hass.data[DOMAIN].remove(entry.entry_id)
    return ok


async def async_remove_entry(hass: HomeAssistant, entry: ApplianceConfigEntry) -> None:
    from homeassistant.helpers import issue_registry as ir
    from homeassistant.helpers.storage import Store

    await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_remove()
    ir.async_delete_issue(hass, DOMAIN, f"wear_{entry.entry_id}")

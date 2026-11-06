"""Add a machine: pick its power reading (found for you), the rest is guessed."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er, selector

from .const import CONF_DOOR, CONF_ENERGY, CONF_KIND, CONF_POWER, CONF_SWITCH, DOMAIN, KINDS
from .hub import _clean_name, guess_kind


def _same_device(hass: HomeAssistant, power: str, domain: str, device_class: str | None = None) -> str | None:
    """An entity on the same plug as the power reading (its energy meter, its switch)."""
    entities = er.async_get(hass)
    entry = entities.async_get(power)
    if entry is None or not entry.device_id:
        return None
    for e in er.async_entries_for_device(entities, entry.device_id):
        if e.domain != domain or e.disabled_by:
            continue
        state = hass.states.get(e.entity_id)
        if device_class and (state is None or state.attributes.get("device_class") != device_class):
            continue
        if device_class == "energy" and state and state.attributes.get("state_class") not in ("total", "total_increasing"):
            continue
        return e.entity_id
    return None


def _guess(hass: HomeAssistant, power: str) -> dict[str, Any]:
    state = hass.states.get(power)
    entry = er.async_get(hass).async_get(power)
    device = dr.async_get(hass).async_get(entry.device_id) if entry and entry.device_id else None
    device_name = (device.name_by_user or device.name) if device else None
    friendly = state.attributes.get("friendly_name") if state else None
    return {
        CONF_NAME: _clean_name(device_name or friendly or power),
        CONF_KIND: guess_kind(power, friendly, device_name),
        CONF_ENERGY: _same_device(hass, power, "sensor", "energy"),
        CONF_SWITCH: _same_device(hass, power, "switch"),
    }


def _details(defaults: dict[str, Any], name: bool = True) -> vol.Schema:
    fields: dict[Any, Any] = {}
    if name:
        fields[vol.Required(CONF_NAME, default=defaults.get(CONF_NAME, ""))] = selector.TextSelector()
    fields[vol.Required(CONF_KIND, default=defaults.get(CONF_KIND, "other"))] = selector.SelectSelector(
        selector.SelectSelectorConfig(options=KINDS, translation_key="kind", mode=selector.SelectSelectorMode.LIST)
    )
    for key, sel in (
        (CONF_DOOR, selector.EntitySelector(selector.EntitySelectorConfig(
            domain="binary_sensor", device_class=["door", "opening", "window"]))),
        (CONF_ENERGY, selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", device_class="energy"))),
        (CONF_SWITCH, selector.EntitySelector(selector.EntitySelectorConfig(domain="switch"))),
    ):
        value = defaults.get(key)
        fields[vol.Optional(key, description={"suggested_value": value} if value else None)] = sel
    return vol.Schema(fields)


class ApplianceWatchFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._power: str | None = None
        self._defaults: dict[str, Any] = {}

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> OptionsFlow:
        return ApplianceWatchOptions()

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return await self._chosen(user_input[CONF_POWER])
        hub = self.hass.data.get(DOMAIN)
        found = hub.candidates() if hub else []
        schema = vol.Schema({
            vol.Required(CONF_POWER, default=found[0]["entity_id"]) if found else vol.Required(CONF_POWER):
                selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", device_class="power")),
        })
        return self.async_show_form(
            step_id="user", data_schema=schema,
            description_placeholders={"found": ", ".join(f["name"] for f in found) or "-"},
        )

    async def async_step_integration_discovery(self, discovery_info: dict[str, Any]) -> ConfigFlowResult:
        await self.async_set_unique_id(discovery_info[CONF_POWER])
        self._abort_if_unique_id_configured()
        self._power = discovery_info[CONF_POWER]
        self._defaults = {**_guess(self.hass, self._power), CONF_KIND: discovery_info[CONF_KIND],
                          CONF_NAME: discovery_info.get("name") or _guess(self.hass, self._power)[CONF_NAME]}
        self.context["title_placeholders"] = {"name": self._defaults[CONF_NAME]}
        return await self.async_step_details()

    async def _chosen(self, power: str) -> ConfigFlowResult:
        await self.async_set_unique_id(power)
        self._abort_if_unique_id_configured()
        self._power = power
        self._defaults = _guess(self.hass, power)
        return await self.async_step_details()

    async def async_step_details(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            data = {CONF_POWER: self._power, **{k: v for k, v in user_input.items() if k != CONF_NAME and v}}
            return self.async_create_entry(title=user_input[CONF_NAME], data=data)
        return self.async_show_form(
            step_id="details", data_schema=_details(self._defaults),
            description_placeholders={"power": self._power or ""},
        )


class ApplianceWatchOptions(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data={k: v for k, v in user_input.items() if v})
        current = dict(self.config_entry.options or self.config_entry.data)
        return self.async_show_form(step_id="init", data_schema=_details(current, name=False))

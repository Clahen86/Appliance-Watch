"""Finding machines: a power sensor that looks like a machine is suggested - but not a dead plug, and not the old plug
of a machine already set up under the same name (a replaced plug)."""

from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.core import HomeAssistant

from custom_components.appliance_watch.const import CONF_POWER, DOMAIN
from custom_components.appliance_watch.hub import Hub

W = {"device_class": "power", "unit_of_measurement": "W"}


async def test_suggests_only_new_living_machines(hass: HomeAssistant) -> None:
    MockConfigEntry(domain=DOMAIN, title="Vaskemaskine", data={CONF_POWER: "sensor.vaskemaskine_power"}).add_to_hass(hass)
    hass.states.async_set("sensor.vaskemaskine_power", "0.4", W | {"friendly_name": "Vaskemaskine Power"})
    hass.states.async_set("sensor.vaskemaskine_power_2", "1.0", W | {"friendly_name": "Vaskemaskine Power"})  # old plug
    hass.states.async_set("sensor.torretumbler_power_2", "unavailable", W | {"friendly_name": "Tørretumbler Power"})  # removed
    hass.states.async_set("sensor.opvaskemaskine_effekt", "2.0", W | {"friendly_name": "Opvaskemaskine Effekt"})  # new

    found = Hub(hass).candidates()
    assert [c["entity_id"] for c in found] == ["sensor.opvaskemaskine_effekt"]

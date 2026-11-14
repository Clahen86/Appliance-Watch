"""How Appliance Watch is set up - for the developer (support.py sends it once a day with the errors; names cleaned
unless the user turns on "Share my setup"). The machines: their kind, the plug's brand and the entities used - never a
machine's name, a programme's name or when it ran."""

from __future__ import annotations

from typing import Any

from homeassistant.helpers import entity_registry as er

from .const import CONF_DOOR, CONF_ENERGY, CONF_POWER, CONF_SPEAKER, CONF_SWITCH, SET_AI, SET_FINISH_AFTER_DRY, SET_NOTIFY_START, SET_ONLY_HOME, SET_PRICE, STATE_ALERT


def setup_info(hass: Any, hub: Any, support: Any) -> dict[str, Any]:
    reg = er.async_get(hass)
    devices = []
    for m in hub.machines.values():
        power = m.option(CONF_POWER)
        ent = reg.async_get(power) if power else None
        entities = [support.entity(e, use) for use, key in (("power", CONF_POWER), ("energy", CONF_ENERGY), ("switch", CONF_SWITCH),
                                                              ("door", CONF_DOOR), ("speaker", CONF_SPEAKER))
                    if isinstance(e := m.option(key), str) and e]
        cycles = m.cycles or []
        devices.append({
            "kind": m.kind, "platform": ent.platform if ent else None, **support.device(ent.device_id if ent else None),
            "ok": m.state != STATE_ALERT, "entities": entities,
            "extra": {"cycles": len(cycles), "clean": sum(1 for c in cycles if c.get("clean")), "programs": len(m.programs),
                      "named": sum(1 for p in m.programs.values() if p.get("name")), "findings": len(m.findings),
                      "state": m.state, "watched": m.watcher is not None},
        })
    st = hub.settings
    return {"devices": devices, "counts": {"machines": len(hub.machines)},
            "features": {"only_home": bool(st.get(SET_ONLY_HOME)), "notify_start": bool(st.get(SET_NOTIFY_START)),
                         "finish_after_dry": bool(st.get(SET_FINISH_AFTER_DRY)), "ai": bool(st.get(SET_AI)),
                         "price": bool(st.get(SET_PRICE)), "house_chat": bool(hub._house_chat_tells()) if hasattr(hub, "_house_chat_tells") else False}}

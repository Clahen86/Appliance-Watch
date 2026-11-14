"""The AI helps with words only - names for programmes and explaining an odd cycle. It never measures anything."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

from .texts import lang

_LOGGER = logging.getLogger(__name__)
_LANGS = {"da": "Danish", "en": "English", "de": "German", "sv": "Swedish", "nb": "Norwegian Bokmål", "nl": "Dutch", "fr": "French"}


async def ask(hass: HomeAssistant, entity_id: str, instructions: str) -> str | None:
    try:
        response = await hass.services.async_call(
            "ai_task", "generate_data",
            {"entity_id": entity_id, "task_name": "Appliance Watch", "instructions": instructions},
            blocking=True, return_response=True,
        )
    except Exception as err:  # noqa: BLE001 - no answer is fine: the AI is only a helper
        _LOGGER.debug("AI task failed: %s", err)
        return None
    data = (response or {}).get("data")
    return str(data).strip() if data else None


def _language(hass: HomeAssistant) -> str:
    return _LANGS.get(lang(hass), hass.config.language or "English")


def _describe(c: dict[str, Any]) -> str:
    return (f"{round(c['duration'] / 60)} min, {c['wh'] / 1000:.2f} kWh, heating {round(c.get('heat_s', 0) / 60)} min "
            f"in {c.get('phases', 0)} periods, peak {round(c.get('peak', 0))} W")


async def name_program(hass: HomeAssistant, entity_id: str, kind: str, cycles: list[dict[str, Any]], taken: list[str]) -> str | None:
    lines = "\n".join(f"- {_describe(c)}" for c in cycles[-5:])
    text = await ask(hass, entity_id, (
        f"A household {kind} ran this programme (measured with a smart plug):\n{lines}\n"
        f"Names already used for its other programmes: {', '.join(taken) or 'none'}.\n"
        f"Which programme is it most likely? Answer with only a short name like the ones on the machine's dial, "
        f"in {_language(hass)}, with the temperature if you can tell (e.g. 'Eco 50°', 'Quick 30°', 'Intensive 70°'). "
        f"No explanation."
    ))
    return text.strip().strip('"').splitlines()[0][:40] if text else None


async def explain(hass: HomeAssistant, entity_id: str, kind: str, cycle: dict[str, Any], usual: dict[str, Any] | None,
                  reason: str | None) -> str | None:
    normal = (f"Usually this programme takes {round(usual['duration'] / 60)} min and {usual['wh'] / 1000:.2f} kWh."
              if usual else "There is no usual run of this programme yet.")
    return await ask(hass, entity_id, (
        f"A household {kind} measured with a smart plug: {_describe(cycle)}. It ended by: {reason or cycle.get('end_reason')}. "
        f"Pauses longer than 90 s (seconds): {cycle.get('gaps', [])}. {normal}\n"
        f"In {_language(hass)}, in at most three short sentences a non-technical person understands: what probably "
        f"happened, and whether they should do something."
    ))

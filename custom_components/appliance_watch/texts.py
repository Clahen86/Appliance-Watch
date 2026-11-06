"""Words for notifications and Assist (the panel and the card have their own)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

TEXT: dict[str, dict[str, str]] = {
    "en": {
        "program": "Program",
        "done_title": "{icon} {name} is done",
        "done": "{details}",
        "move_to_dryer": "Move the laundry to the dryer.",
        "remind_title": "{icon} {name} is waiting to be emptied",
        "remind": "Done {minutes} min ago.",
        "resumed_title": "{icon} {name} is still running",
        "resumed": "It only took a break - learned, it won't happen again.",
        "start_title": "{icon} {name} started",
        "start": "{details}",
        "start_done_at": "done about {time}",
        "emptied": "Emptied ✓",
        "fault_too_long": "{name} has run unusually long ({minutes} min). Is something stuck?",
        "fault_stopped_early": "{name} stopped much earlier than usual. Did it finish?",
        "fault_power_lost": "{name} lost power during the programme.",
        "wear_heat_slower": "{name} takes {percent}% longer to heat than it used to. Descaling may help.",
        "wear_longer": "{name}'s programmes take {percent}% longer than they used to.",
        "say_running": "{name} is done in about {minutes} minutes, at {time}.",
        "say_running_soon": "{name} is nearly done.",
        "say_running_unknown": "{name} is running. I don't know the programme yet, so not when it's done.",
        "say_finishing": "{name} is just finishing - done in a few minutes.",
        "say_finished": "{name} is done and waiting to be emptied.",
        "say_off": "{name} isn't running.",
        "say_none": "I don't know that machine.",
        "minutes": "{n} min",
        "hours": "{h} h {m} min",
    },
    "da": {
        "program": "Program",
        "done_title": "{icon} {name} er færdig",
        "done": "{details}",
        "move_to_dryer": "Flyt tøjet over i tørretumbleren.",
        "remind_title": "{icon} {name} venter på at blive tømt",
        "remind": "Færdig for {minutes} min siden.",
        "resumed_title": "{icon} {name} kører stadig",
        "resumed": "Den holdt bare en pause - det har jeg lært, så det sker ikke igen.",
        "start_title": "{icon} {name} er startet",
        "start": "{details}",
        "start_done_at": "færdig ca. {time}",
        "emptied": "Tømt ✓",
        "fault_too_long": "{name} har kørt usædvanligt længe ({minutes} min). Sidder noget fast?",
        "fault_stopped_early": "{name} stoppede meget tidligere end normalt. Blev den færdig?",
        "fault_power_lost": "{name} mistede strømmen under programmet.",
        "wear_heat_slower": "{name} er {percent}% længere om at varme op end før. En afkalkning kan hjælpe.",
        "wear_longer": "{name} er {percent}% længere om programmerne end før.",
        "say_running": "{name} er færdig om cirka {minutes} minutter, klokken {time}.",
        "say_running_soon": "{name} er næsten færdig.",
        "say_running_unknown": "{name} kører. Jeg kender ikke programmet endnu, så ikke hvornår den er færdig.",
        "say_finishing": "{name} er ved at blive færdig - om få minutter.",
        "say_finished": "{name} er færdig og venter på at blive tømt.",
        "say_off": "{name} kører ikke.",
        "say_none": "Den maskine kender jeg ikke.",
        "minutes": "{n} min",
        "hours": "{h} t {m} min",
    },
}

ICONS = {"dishwasher": "🍽️", "washer": "🧺", "dryer": "🌀", "other": "🔌"}


def lang(hass: HomeAssistant, language: str | None = None) -> str:
    code = (language or hass.config.language or "en").split("-")[0].lower()
    return code if code in TEXT else "en"


def t(hass: HomeAssistant, key: str, language: str | None = None, **kw: Any) -> str:
    return TEXT[lang(hass, language)][key].format(**kw)


def duration(hass: HomeAssistant, seconds: float, language: str | None = None) -> str:
    minutes = round(seconds / 60)
    if minutes < 60:
        return t(hass, "minutes", language, n=minutes)
    return t(hass, "hours", language, h=minutes // 60, m=minutes % 60)


def money(value: float | None, currency: str | None) -> str | None:
    if value is None:
        return None
    return f"{value:.2f} {currency}".replace(".", ",") if currency in ("kr", "kr.", "DKK", "SEK", "NOK") \
        else f"{value:.2f} {currency or ''}".strip()

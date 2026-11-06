"""Saying it out loud on the speakers: done, nearly done, not emptied, emptied, move to the dryer, started.

Each can be switched on and off. Quiet at night (what wasn't said is said in the morning, if it still matters), and
only when someone is home. Played as an announcement, so music pauses and comes back.
"""

from __future__ import annotations

from datetime import datetime
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.const import STATE_HOME
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .const import (
    CONF_SPEAKER,
    SET_QUIET,
    SET_QUIET_FROM,
    SET_QUIET_TO,
    SET_SAY,
    SET_SAY_HOME,
    SET_SPEAKERS,
    SET_TTS,
    STATE_FINISHED,
)
from .texts import t

if TYPE_CHECKING:
    from .hub import Hub
    from .machine import Machine

_LOGGER = logging.getLogger(__name__)


def _minutes(text: str | None, default: int) -> int:
    try:
        h, m = str(text).split(":")[:2]
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return default


class Speaker:
    def __init__(self, hass: HomeAssistant, hub: Hub) -> None:
        self.hass, self.hub = hass, hub
        self.morning: set[str] = set()  # machines that finished during quiet hours
        self._unsub: Any = None

    def start(self) -> None:
        if self._unsub is None:
            self._unsub = async_track_time_change(self.hass, self._minute, second=0)

    def stop(self) -> None:
        if self._unsub is not None:
            self._unsub()
            self._unsub = None

    @property
    def settings(self) -> dict[str, Any]:
        return self.hub.settings

    def wants(self, kind: str) -> bool:
        return bool((self.settings.get(SET_SAY) or {}).get(kind))

    def quiet_now(self, now: datetime | None = None) -> bool:
        if not self.settings.get(SET_QUIET):
            return False
        now = dt_util.as_local(now or dt_util.now())
        a, b = _minutes(self.settings.get(SET_QUIET_FROM), 1320), _minutes(self.settings.get(SET_QUIET_TO), 420)
        m = now.hour * 60 + now.minute
        return a <= m < b if a <= b else m >= a or m < b

    def someone_home(self) -> bool:
        zone = self.hass.states.get("zone.home")
        if zone is not None and zone.state.isdigit():
            return int(zone.state) > 0
        persons = self.hass.states.async_all("person")
        return not persons or any(p.state == STATE_HOME for p in persons)

    def players(self, machine: Machine | None) -> list[str]:
        if machine is not None and (own := machine.option(CONF_SPEAKER)):
            return [own]
        return list(self.settings.get(SET_SPEAKERS) or [])

    async def async_say(self, machine: Machine | None, kind: str, text: str, test: bool = False,
                        players: list[str] | None = None) -> bool:
        """Say it, if this kind is on, it isn't night and someone is home. Returns whether it was said."""
        if not test:
            if not self.wants(kind):
                return False
            if self.quiet_now():
                if machine is not None and kind in ("done", "remind", "dryer"):
                    self.morning.add(machine.entry.entry_id)
                return False
            if self.settings.get(SET_SAY_HOME) and not self.someone_home():
                return False
        targets = players or self.players(machine)
        if not targets:
            return False
        try:
            media = _media_id(self.hass, text, self.settings.get(SET_TTS))
            await self.hass.services.async_call("media_player", "play_media", {
                "entity_id": targets, "media_content_id": media, "media_content_type": "music", "announce": True,
            }, blocking=False)
            return True
        except Exception:  # noqa: BLE001 - a speaker that's off or no voice set up: the phone still tells
            _LOGGER.warning("Could not say %r on %s", text, targets, exc_info=True)
            return False

    @callback
    def _minute(self, now: datetime) -> None:
        """When the quiet hours end: what finished in the night and still waits is said now."""
        if not self.morning or not self.settings.get(SET_QUIET):
            return
        local = dt_util.as_local(now)
        if local.hour * 60 + local.minute != _minutes(self.settings.get(SET_QUIET_TO), 420):
            return
        waiting = [self.hub.machines[e] for e in self.morning if e in self.hub.machines]
        self.morning.clear()
        for m in waiting:
            if m.state == STATE_FINISHED:
                self.hass.async_create_task(
                    self.async_say(m, "done", t(self.hass, "say_morning", name=m.name)), eager_start=False)


def _media_id(hass: HomeAssistant, text: str, engine: str | None) -> str:
    """The spoken text as media: in the home's language when the voice speaks it, else in the voice's own."""
    from homeassistant.components import tts

    try:
        return tts.generate_media_source_id(hass, text, engine=engine, language=hass.config.language)
    except HomeAssistantError:
        return tts.generate_media_source_id(hass, text, engine=engine)


def spoken_money(hass: HomeAssistant, value: float | None, currency: str | None) -> str | None:
    if value is None:
        return None
    if currency in ("kr", "kr.", "DKK", "SEK", "NOK"):
        kr, ore = int(value), round((value - int(value)) * 100)
        return t(hass, "say_kr", kr=kr, ore=ore) if ore else t(hass, "say_kr_only", kr=kr)
    return f"{value:.2f} {currency or ''}".strip()


def spoken_wait(hass: HomeAssistant, minutes: int) -> str:
    if minutes < 60:
        return t(hass, "say_minutes", n=minutes)
    hours = round(minutes / 60)
    return t(hass, "say_hour") if hours == 1 else t(hass, "say_hours", n=hours)

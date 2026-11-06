"""Constants for Appliance Watch."""

from __future__ import annotations

from dataclasses import dataclass

DOMAIN = "appliance_watch"
SIGNAL_UPDATE = f"{DOMAIN}_update_{{}}"
EVENT_STARTED = f"{DOMAIN}_started"
EVENT_FINISHED = f"{DOMAIN}_finished"
EVENT_EMPTIED = f"{DOMAIN}_emptied"
ACTION_EMPTIED = "APPLIANCE_WATCH_EMPTIED_"

CONF_POWER = "power_sensor"
CONF_ENERGY = "energy_sensor"
CONF_DOOR = "door_sensor"
CONF_SWITCH = "switch"
CONF_KIND = "kind"

# Global settings (panel ⚙️), kept in the integration's own store.
SET_NOTIFY = "notify"
SET_ONLY_HOME = "only_home"
SET_REMIND = "remind_minutes"
SET_PRICE = "price_sensor"
SET_AI = "ai_task"
SET_CHEAP = "cheap_saving"
SET_NOTIFY_START = "notify_start"
SET_FINISH_AFTER_DRY = "finish_after_drying"
DEFAULT_SETTINGS = {
    SET_NOTIFY: [],
    SET_ONLY_HOME: True,
    SET_REMIND: 60,
    SET_PRICE: None,
    SET_AI: None,
    SET_CHEAP: 1.0,
    SET_NOTIFY_START: False,
    SET_FINISH_AFTER_DRY: False,
}

KIND_DISHWASHER = "dishwasher"
KIND_WASHER = "washer"
KIND_DRYER = "dryer"
KIND_OTHER = "other"
KINDS = [KIND_DISHWASHER, KIND_WASHER, KIND_DRYER, KIND_OTHER]

STATE_OFF = "off"
STATE_RUNNING = "running"
STATE_FINISHING = "finishing"
STATE_FINISHED = "finished"
STATES = [STATE_OFF, STATE_RUNNING, STATE_FINISHING, STATE_FINISHED]

# Words in a sensor, device or area name that tell which machine it is. Danish, English, German, Swedish, Dutch.
KIND_WORDS = {
    KIND_DISHWASHER: ("opvask", "dishwasher", "geschirr", "diskmaskin", "vaatwas", "oppvask", "dish"),
    KIND_DRYER: ("tørretumbler", "torretumbler", "tumbler", "tørre", "dryer", "trockner", "torktumlare", "droger"),
    KIND_WASHER: ("vaskemaskine", "vaskemask", "washer", "washing", "waschmaschine", "tvättmaskin", "wasmachine",
                  "laundry", "vasketøj"),
}


@dataclass(frozen=True)
class Profile:
    """How a kind of machine behaves. Levels are learned per machine on top of this."""

    active_w: float  # above this the machine is doing something (pump, motor, heat)
    heat_w: float  # above this it heats
    end_quiet_s: float  # quiet this long = done, until the programme's own gaps are learned
    min_quiet_s: float  # never shorter than this, however well a programme is known
    needs_heat: bool  # only done after it has heated (a dishwasher always heats; a cold wash doesn't)
    min_cycle_s: float  # shorter than this was not a programme
    burst_s: float  # activity shorter than this after the end is the machine finishing off (pump, anti-crease)


PROFILES = {
    KIND_DISHWASHER: Profile(25, 800, 600, 240, True, 600, 180),
    KIND_WASHER: Profile(25, 800, 480, 240, False, 600, 120),
    KIND_DRYER: Profile(25, 400, 300, 180, False, 600, 240),
    KIND_OTHER: Profile(10, 800, 600, 180, False, 300, 120),
}

# Waiting to be emptied this long without a door or a tap: assume someone did.
FINISHED_KEEP_S = 12 * 3600
# Activity this soon after "done" (and before anyone opened the door) means it wasn't done.
RESUME_WINDOW_S = 20 * 60
MAX_CYCLE_S = 10 * 3600
POWER_LOST_S = 30 * 60
CYCLES_KEPT = 300

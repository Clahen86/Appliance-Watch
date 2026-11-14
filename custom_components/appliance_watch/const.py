"""Constants for Appliance Watch."""

from __future__ import annotations

from dataclasses import dataclass

DOMAIN = "appliance_watch"
SIGNAL_UPDATE = f"{DOMAIN}_update_{{}}"
EVENT_STARTED = f"{DOMAIN}_started"
EVENT_FINISHED = f"{DOMAIN}_finished"
EVENT_EMPTIED = f"{DOMAIN}_emptied"
EVENT_ALERT = f"{DOMAIN}_alert"  # a watched machine (freezer, dehumidifier): trouble, or working again
ACTION_EMPTIED = "APPLIANCE_WATCH_EMPTIED_"

CONF_POWER = "power_sensor"
CONF_ENERGY = "energy_sensor"
CONF_DOOR = "door_sensor"
CONF_SWITCH = "switch"
CONF_KIND = "kind"
CONF_SPEAKER = "speaker"

# Global settings (panel ⚙️), kept in the integration's own store.
SET_NOTIFY = "notify"
SET_ONLY_HOME = "only_home"
SET_REMIND = "remind_minutes"
SET_PRICE = "price_sensor"  # a price sensor, or "energy_pilot" (Energy Pilot's total price)
SET_PRICE_ADD = "price_add"  # grid tariff and taxes per kWh, on top of a spot price
SET_PRICE_VAT = "price_vat"  # VAT in %, on top of a spot price
SET_PEAK_ADD = "price_peak_add"  # extra per kWh in a dearer period (e.g. 17-21)
SET_PEAK_FROM = "price_peak_from"
SET_PEAK_TO = "price_peak_to"
SET_AI = "ai_task"
SET_CHEAP = "cheap_saving"
SET_NOTIFY_START = "notify_start"
SET_FINISH_AFTER_DRY = "finish_after_drying"
SET_SPEAKERS = "speakers"
SET_TTS = "tts"
SET_SAY = "say"
SET_SAY_HOME = "say_only_home"
SET_QUIET = "quiet"
SET_QUIET_FROM = "quiet_from"
SET_QUIET_TO = "quiet_to"
SAY_KINDS = ["done", "soon", "remind", "dryer", "emptied", "started"]
DEFAULT_SETTINGS = {
    SET_NOTIFY: [],
    SET_ONLY_HOME: True,
    SET_REMIND: 60,
    SET_PRICE: None,
    SET_PRICE_ADD: 0.0,
    SET_PRICE_VAT: 0.0,
    SET_PEAK_ADD: 0.0,
    SET_PEAK_FROM: "17:00",
    SET_PEAK_TO: "21:00",
    SET_AI: None,
    SET_CHEAP: 1.0,
    SET_NOTIFY_START: False,
    SET_FINISH_AFTER_DRY: False,
    SET_SPEAKERS: [],
    SET_TTS: None,
    SET_SAY: {"done": True, "soon": True, "remind": True, "dryer": True, "emptied": False, "started": False},
    SET_SAY_HOME: True,
    SET_QUIET: True,
    SET_QUIET_FROM: "22:00",
    SET_QUIET_TO: "07:00",
}

KIND_DISHWASHER = "dishwasher"
KIND_WASHER = "washer"
KIND_DRYER = "dryer"
KIND_WASHER_DRYER = "washer_dryer"
KIND_PRINTER = "printer"
KIND_OVEN = "oven"
KIND_COFFEE = "coffee"
KIND_DEHUMIDIFIER = "dehumidifier"
KIND_FREEZER = "freezer"
KIND_OTHER = "other"
KINDS = [KIND_DISHWASHER, KIND_WASHER, KIND_DRYER, KIND_WASHER_DRYER, KIND_PRINTER, KIND_OVEN, KIND_COFFEE,
         KIND_DEHUMIDIFIER, KIND_FREEZER, KIND_OTHER]
# Machines that run all the time: watched for trouble (stopped, never stops, tank full) instead of cycles.
WATCH_KINDS = {KIND_DEHUMIDIFIER, KIND_FREEZER}

STATE_OFF = "off"
STATE_RUNNING = "running"
STATE_FINISHING = "finishing"
STATE_FINISHED = "finished"
STATE_ALERT = "alert"
STATES = [STATE_OFF, STATE_RUNNING, STATE_FINISHING, STATE_FINISHED, STATE_ALERT]

# Words in a sensor, device or area name that tell which machine it is. Danish, English, German, Swedish, Dutch.
KIND_WORDS = {
    KIND_DISHWASHER: ("opvask", "dishwasher", "geschirr", "diskmaskin", "vaatwas", "oppvask", "dish"),
    KIND_DRYER: ("tørretumbler", "torretumbler", "tumbler", "tørre", "dryer", "trockner", "torktumlare", "droger"),
    KIND_WASHER: ("vaskemaskine", "vaskemask", "washer", "washing", "waschmaschine", "tvättmaskin", "wasmachine",
                  "laundry", "vasketøj", "vaskemaskin", "lave-linge", "lave_linge"),
    KIND_WASHER_DRYER: ("vasketørre", "vaske-tørre", "vaske_tørre", "vasketorre", "washer_dryer", "washer-dryer", "washerdryer",
                        "waschtrockner", "kombimaskin", "tvättork", "was-droog", "wasdroog", "lavante-séchante", "lavante_sechante"),
    KIND_PRINTER: ("3d_print", "3d-print", "3dprint", "3d print", "printer_3d", "bambu", "prusa", "creality", "octoprint", "klipper",
                   "voron", "ender", "anycubic", "elegoo", "druck"),
    KIND_OVEN: ("airfryer", "air_fryer", "air fryer", "heißluft", "airfry", "ovn", "oven", "backofen", "ugn", "four", "brødmaskine",
                "brodmaskine", "bread", "brotback", "brödmaskin", "broodbak", "machine_a_pain"),
    KIND_COFFEE: ("kaffe", "coffee", "espresso", "kaffee", "koffie", "café", "cafe", "nespresso", "moccamaster", "barista", "senseo"),
    KIND_DEHUMIDIFIER: ("affugter", "dehumid", "luftentfeuchter", "avfuktare", "avfukter", "ontvochtiger", "déshumid", "deshumid",
                        "affugt"),
    KIND_FREEZER: ("fryser", "freezer", "gefrier", "frys", "vriezer", "congélateur", "congelateur", "køleskab", "koeleskab", "kyl",
                   "fridge", "refrigerator", "kühlschrank", "kuhlschrank", "kjøleskap", "koelkast", "réfrigérateur", "frigo"),
}
# The order words are tried: the more particular before the general ("vaske-tørre" before "vask" and "tørre").
KIND_ORDER = (KIND_WASHER_DRYER, KIND_DISHWASHER, KIND_DRYER, KIND_WASHER, KIND_PRINTER, KIND_DEHUMIDIFIER, KIND_FREEZER,
              KIND_COFFEE, KIND_OVEN)


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
    KIND_WASHER_DRYER: Profile(25, 700, 600, 240, False, 900, 240),  # washes, then dries: long rests between
    KIND_PRINTER: Profile(15, 150, 300, 120, False, 600, 60),  # heated bed, then a long low steady print
    KIND_OVEN: Profile(30, 600, 240, 120, True, 300, 60),  # airfryer, oven, bread machine
    KIND_COFFEE: Profile(20, 500, 90, 60, True, 45, 30),
    KIND_DEHUMIDIFIER: Profile(40, 2000, 900, 900, False, 600, 0),  # watched, not cycles
    KIND_FREEZER: Profile(25, 2000, 900, 900, False, 300, 0),  # watched, not cycles
    KIND_OTHER: Profile(10, 800, 600, 180, False, 300, 120),
}

# Waiting to be emptied this long without a door or a tap: assume someone did.
FINISHED_KEEP_S = 12 * 3600
# Activity this soon after "done" (and before anyone opened the door) means it wasn't done.
RESUME_WINDOW_S = 20 * 60
MAX_CYCLE_S = 10 * 3600
POWER_LOST_S = 30 * 60
CYCLES_KEPT = 300

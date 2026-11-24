"""Machines that run all the time: a freezer that stops or never stops, a dehumidifier with a full tank."""

from custom_components.appliance_watch.const import STATE_ALERT, STATE_OFF, STATE_RUNNING
from custom_components.appliance_watch.watcher import Watcher

H = 3600


def run(w, pattern, t=0.0, step=60):
    events = []
    for watts, seconds in pattern:
        for _ in range(int(seconds // step)):
            events += w.sample(t, watts)
            t += step
    return events, t


def test_freezer_cycling_normally_gives_no_alert():
    w = Watcher("freezer", 25)
    events, _ = run(w, [(80, 20 * 60), (2, 40 * 60)] * 12)  # 20 min on, 40 min off, 12 hours
    assert events == [] and w.state in (STATE_RUNNING, STATE_OFF)


def test_freezer_that_stops_and_comes_back():
    w = Watcher("freezer", 25)
    events, t = run(w, [(80, 20 * 60), (1, 5 * H)])
    assert events == [("alert", "stopped")] and w.state == STATE_ALERT
    events, _ = run(w, [(80, 20 * 60)], t)
    assert events == [("ok", "stopped")]


def test_freezer_door_open_runs_without_a_break():
    w = Watcher("freezer", 25)
    events, t = run(w, [(80, 20 * 60), (2, 40 * 60)] * 4)  # how it normally runs
    events, _ = run(w, [(90, 4 * H)], t)
    assert events == [("alert", "nonstop")]


def test_inverter_freezer_that_runs_all_the_time_is_normal():
    """An inverter compressor runs nonstop at a low level, and one that cycles runs at only 15 W: no alarms."""
    w = Watcher("freezer", 25)
    events, _ = run(w, [(1, 10 * 60)] + [(28, 2 * H), (34, 2 * H)] * 6)
    assert events == []
    w = Watcher("freezer", 25)
    events, _ = run(w, [(15, 50 * 60), (0.8, 30 * 60)] * 12)
    assert events == []


def test_a_freezer_with_long_normal_runs_learns_them():
    w = Watcher("freezer", 25)
    events, _ = run(w, [(80, 2.5 * H), (2, 1 * H)] * 4 + [(80, 3.5 * H), (2, H)])
    assert events == []  # 3.5 h is within what it does (2.5 h runs)


def test_after_a_long_restart_it_counts_from_now():
    w = Watcher("freezer", 25)
    run(w, [(80, 20 * 60), (2, 40 * 60)] * 4 + [(80, 30 * 60)])
    w2 = Watcher("freezer", 25)
    w2.load(w.dump(), now=w.on_since + 6 * H)  # Home Assistant was off for hours
    assert w2.sample(w.on_since + 6 * H, 80) == []


def test_reading_gone():
    w = Watcher("freezer", 25)
    events, _ = run(w, [(80, 10 * 60), (None, H)])
    assert ("alert", "lost") in events


def test_dehumidifier_with_full_tank():
    w = Watcher("dehumidifier", 40)
    events, t = run(w, [(220, H), (0.5, 50 * 60)])
    assert events == [("alert", "tank")]
    events, _ = run(w, [(220, 10 * 60)], t)  # emptied and running again
    assert events == [("ok", "tank")]


def test_dehumidifier_that_rests_below_3_w_at_its_target_learns_it():
    """Some stop the fan too when the air is dry enough (1.5 W): after a few such rests, no more "tank full"."""
    w = Watcher("dehumidifier", 40)
    events, t = run(w, [(220, 40 * 60), (1.5, 30 * 60)] * 6)
    assert events == []
    events, t = run(w, [(220, 40 * 60), (1.5, 50 * 60)] * 6, t)  # longer rests once known: still fine
    assert events == []
    events, _ = run(w, [(220, 40 * 60), (0.2, 30 * 60)], t)  # quiet at another level: the tank
    assert events == [("alert", "tank")]


def test_dehumidifier_at_its_target_runs_the_fan_and_is_fine():
    w = Watcher("dehumidifier", 40)
    events, _ = run(w, [(220, H), (12, 2 * H)])  # compressor off, fan on: target reached
    assert events == []


def test_remembered_across_a_restart():
    w = Watcher("freezer", 25)
    run(w, [(80, 20 * 60), (1, 5 * H)])
    w2 = Watcher("freezer", 25)
    w2.load(w.dump())
    assert w2.state == STATE_ALERT

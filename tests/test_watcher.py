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
    events, _ = run(w, [(90, 4 * H)])
    assert events == [("alert", "nonstop")]


def test_reading_gone():
    w = Watcher("freezer", 25)
    events, _ = run(w, [(80, 10 * 60), (None, H)])
    assert ("alert", "lost") in events


def test_dehumidifier_with_full_tank():
    w = Watcher("dehumidifier", 40)
    events, t = run(w, [(220, H), (0.5, 30 * 60)])
    assert events == [("alert", "tank")]
    events, _ = run(w, [(220, 10 * 60)], t)  # emptied and running again
    assert events == [("ok", "tank")]


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

"""The detector on real readings from a dishwasher, a washing machine and a dryer."""

from datetime import datetime
from zoneinfo import ZoneInfo

from custom_components.appliance_watch import learning
from custom_components.appliance_watch.const import PROFILES, STATE_FINISHED, STATE_OFF, STATE_RUNNING
from custom_components.appliance_watch.detector import Detector

from .conftest import readings

CPH = ZoneInfo("Europe/Copenhagen")


def run(kind: str, learn: bool = False):
    """Feed the readings with a tick every 30 s, the way Home Assistant does. Returns (finished cycles, events)."""
    profile = PROFILES[kind]
    d = Detector(profile)
    done, events, programs = [], [], {}
    last = None
    for t, w in readings(kind):
        if last is not None:
            x = last + 30
            while x < t:
                events += [(x, e, c) for e, c in d.tick(x)]
                x += 30
        events += [(t, e, c) for e, c in d.sample(t, w)]
        last = t
        # learn like the machine does: classify each finished cycle, use its programme's rests next time
        while learn and len(done) < sum(1 for _, e, _ in events if e == "finished"):
            c = [c for _, e, c in events if e == "finished"][len(done)]
            pid, _ = learning.classify(c, programs)
            programs.setdefault(pid or f"p{len(programs)}", []).append(dict(c))
            done.append(c)
        if learn and d.cycle is not None and d.confirmed and d.state != STATE_FINISHED:
            pid, _ = learning.match_live(d.cycle, t - d.cycle["start"], programs)
            d.end_quiet_s = learning.end_quiet(profile, learning.stats(programs.get(pid, [])) if pid else None)
    finished = [(when, c) for when, e, c in events if e == "finished"]
    return finished, events


def local(ts: float) -> str:
    return datetime.fromtimestamp(ts, CPH).strftime("%m-%d %H:%M")


def test_dishwasher_done_when_it_is_done():
    finished, events = run("dishwasher")
    assert [local(c["start"]) for _, c in finished] == [
        "11-03 13:39", "11-03 17:51", "11-04 13:44", "11-04 21:49", "11-05 13:55", "11-06 10:14"]
    # Today: the work ended 11:08 and it dried at 5-15 W until 11:26. Done within the first ten minutes of drying -
    # not two hours later as WashData said (13:19).
    when, today = finished[-1]
    assert local(today["end"]) == "11-06 11:08"
    assert when - today["end"] <= 660
    assert all(c["end_reason"] == "quiet" for _, c in finished)
    assert not any(e == "resumed" for _, e, _ in events)


def test_dishwasher_learned_is_faster():
    finished, _ = run("dishwasher", learn=True)
    when, today = finished[-1]
    assert when - today["end"] <= 7 * 60  # its pauses are ~3.5 min: done ~6 min after the work stopped


def test_washer_and_dryer():
    for kind, starts in (("washer", ["10-29 15:01", "10-29 20:24", "10-30 12:09"]),
                         ("dryer", ["10-28 20:48", "10-29 21:36", "10-30 15:17"])):
        finished, events = run(kind)
        assert [local(c["start"]) for _, c in finished] == starts, kind
        for when, c in finished:
            assert when - c["end"] <= PROFILES[kind].end_quiet_s + 60
        assert not any(e == "resumed" for _, e, _ in events)


def test_resumes_after_a_long_pause_and_learns_it():
    p = PROFILES["dishwasher"]
    d = Detector(p)
    t = 1_000_000.0
    def run_for(seconds, w):
        nonlocal t
        evs = d.sample(t, w)
        for _ in range(int(seconds // 30)):
            t += 30
            evs += d.tick(t)
        return evs
    run_for(600, 1900)  # heats
    run_for(600, 60)  # washes
    evs = run_for(900, 8)  # a 15 min rest - longer than it knows: "done"
    assert any(e == "finished" for e, _ in evs)
    assert d.state == STATE_FINISHED
    evs = run_for(600, 1900)  # it heats again: it wasn't done
    assert any(e == "resumed" for e, _ in evs)
    assert d.state == STATE_RUNNING
    assert max(d.cycle["gaps"]) >= 600
    assert learning.end_quiet(p, learning.stats([{**d.cycle, "duration": 3000}])) > 900


def test_short_bursts_after_the_end_are_not_a_new_programme():
    d = Detector(PROFILES["dryer"])
    t = 2_000_000.0
    def at(w, seconds):
        nonlocal t
        d.sample(t, w)
        for _ in range(int(seconds // 30)):
            t += 30
            d.tick(t)
    at(700, 3600)
    at(0.8, 400)
    assert d.state == STATE_FINISHED
    for _ in range(5):  # anti-crease: the drum turns a little every few minutes
        at(150, 30)
        at(0.8, 300)
    assert d.state == STATE_FINISHED
    assert d.after_bursts >= 4


def test_door_ends_and_empties():
    d = Detector(PROFILES["dishwasher"])
    t = 3_000_000.0
    d.sample(t, 1900)
    for _ in range(40):
        t += 30
        d.tick(t)
    d.sample(t, 8)
    t += 60
    d.tick(t)
    events = d.door(t, True)
    assert [e for e, _ in events] == ["finished", "emptied"]
    assert d.state == STATE_OFF


def test_door_in_the_middle_is_ignored():
    d = Detector(PROFILES["dishwasher"])
    t = 4_000_000.0
    d.sample(t, 1900)
    for _ in range(4):
        t += 30
        d.tick(t)
    assert d.door(t, True) == []
    assert d.state == STATE_RUNNING


def test_finish_after_drying():
    d = Detector(PROFILES["dishwasher"])
    d.finish_after_drying = True
    d.standby = 0.3
    t = 5_000_000.0
    d.sample(t, 1900)
    for _ in range(40):
        t += 30
        d.tick(t)
    d.sample(t, 12)
    for _ in range(40):  # 20 min drying
        t += 30
        d.tick(t)
    assert d.state != STATE_FINISHED
    events = d.sample(t, 0.3)
    t += 30
    assert any(e == "finished" for e, _ in events + d.tick(t))


def test_lost_power_reading():
    d = Detector(PROFILES["washer"])
    t = 6_000_000.0
    d.sample(t, 400)
    for _ in range(40):
        t += 30
        d.tick(t)
    d.sample(t, None)
    events = []
    for _ in range(70):
        t += 30
        events += d.tick(t)
    assert len(events) == 1
    assert [c["end_reason"] for e, c in events if e == "finished"] == ["power_lost"]
    assert not learning.is_clean(d.cycle, PROFILES["washer"])


def test_quiet_rinse_programme():
    """A cold rinse only runs a small pump at 9-15 W (seen on the real dishwasher): still a programme."""
    d = Detector(PROFILES["dishwasher"], standby=0.2)
    t = 7_000_000.0
    events = []
    def at(w, minutes):
        nonlocal t
        events.extend(d.sample(t, w))
        for _ in range(int(minutes * 2)):
            t += 30
            events.extend(d.tick(t))
    at(0.2, 10)
    at(4, 20)  # the display is on while it is loaded: not a programme
    assert d.state == STATE_OFF
    at(12, 15)
    assert d.state == STATE_RUNNING
    at(0.2, 15)
    finished = [c for e, c in events if e == "finished"]
    assert len(finished) == 1 and 14 * 60 <= finished[0]["duration"] <= 16 * 60


def test_drying_after_emptied_is_not_a_rinse():
    d = Detector(PROFILES["dishwasher"], standby=0.2)
    t = 8_000_000.0
    def at(w, minutes):
        nonlocal t
        d.sample(t, w)
        for _ in range(int(minutes * 2)):
            t += 30
            d.tick(t)
    at(1900, 20)
    at(12, 12)
    assert d.state == STATE_FINISHED
    d.emptied(t)
    at(12, 15)  # still drying after the button was pressed
    assert d.state == STATE_OFF and d.cycle is None


def test_goes_on_after_done_by_hand():
    """'It's done' pressed in a pause (seen on the real rinse): when it goes on, it's the same cycle."""
    d = Detector(PROFILES["dishwasher"], standby=0.2)
    t = 9_000_000.0
    events = []
    def at(w, minutes):
        nonlocal t
        events.extend(d.sample(t, w))
        for _ in range(int(minutes * 2)):
            t += 30
            events.extend(d.tick(t))
    at(12, 4)
    at(45, 6)
    at(4, 5)
    events.extend(d.force_finish(t))
    at(4, 8)
    at(45, 6)
    assert [e for e, _ in events if e in ("finished", "resumed", "started")] == ["started", "finished", "resumed"]

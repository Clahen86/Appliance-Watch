"""Learning: programmes recognised by their shape, never learned from unclear cycles."""

from custom_components.appliance_watch import learning
from custom_components.appliance_watch.const import PROFILES


def cycle(heat_at, minutes, wh_scale=1.0, gaps=(200,)):
    curve = [((31 if i in heat_at else 0.8) * wh_scale) for i in range(minutes)]
    return {"start": 0, "duration": minutes * 60, "wh": sum(curve), "heat_s": len(heat_at) * 60, "curve": curve,
            "gaps": list(gaps), "end_reason": "quiet", "lost_s": 0, "peak": 1900, "phases": 2}


def test_classify_and_live_match():
    quick = [cycle(set(range(2, 14)) | set(range(30, 45)), 50) for _ in range(3)]
    eco = [cycle(set(range(5, 25)) | set(range(100, 120)), 150, gaps=(600, 900)) for _ in range(3)]
    programs = {"quick": quick, "eco": eco}
    assert learning.classify(cycle(set(range(2, 14)) | set(range(30, 45)), 51), programs)[0] == "quick"
    assert learning.classify(cycle(set(range(5, 25)) | set(range(100, 120)), 148), programs)[0] == "eco"
    live = cycle(set(range(2, 14)), 20)
    assert learning.match_live(live, 20 * 60, programs)[0] == "quick"
    # Eco has long pauses: it waits longer before "done"
    assert learning.end_quiet(PROFILES["dishwasher"], learning.stats(eco)) > learning.end_quiet(
        PROFILES["dishwasher"], learning.stats(quick))


def test_unclear_cycles_are_not_learned():
    c = cycle({1, 2}, 50)
    assert learning.is_clean(c, PROFILES["dishwasher"])
    assert not learning.is_clean({**c, "end_reason": "power_lost"}, PROFILES["dishwasher"])
    assert not learning.is_clean({**c, "lost_s": 600}, PROFILES["dishwasher"])


def test_wear():
    old = [cycle(set(range(10)), 50) for _ in range(5)]
    new = [cycle(set(range(13)), 52) for _ in range(5)]
    for i, c in enumerate(old + new):
        c["start"] = i
    assert learning.wear(old + new)[0]["kind"] == "heat_slower"


def test_one_long_pause_by_the_user_is_not_the_programme():
    """One run paused for 25 min by hand mustn't make every later run wait half an hour before "done"."""
    p = PROFILES["dishwasher"]
    runs = [cycle({1, 2}, 50, gaps=(200,)) for _ in range(20)] + [cycle({1, 2}, 75, gaps=(200, 1500))]
    quiet = learning.end_quiet(p, learning.stats(runs))
    assert quiet < 600
    # A rest the programme takes in most runs is learned
    soak = [cycle({1, 2}, 90, gaps=(200, 900)) for _ in range(3)]
    assert learning.end_quiet(p, learning.stats(soak)) > 900


def test_past_its_usual_length_is_any_minute_now():
    st = {"duration": 3000, "wh": 1000}
    assert learning.remaining({"wh": 500}, 1500, st) == 1500
    assert learning.remaining({"wh": 800}, 3100, st) == 0  # was stuck at a minute or more "left"
    assert learning.remaining({"wh": 1100}, 2950, st) == 0

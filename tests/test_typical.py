"""What a usual run takes - read by Energy Pilot to start the machine at the cheapest time."""

from custom_components.appliance_watch.machine import Machine


def test_typical_is_the_programme_run_most_often():
    m = object.__new__(Machine)
    m.program_name = lambda pid, language=None: {"eco": "Eco 50°"}.get(pid, pid)
    m.cycles = [{"start": 0, "end": 180 * 60, "wh": 900, "program": "eco", "clean": True} for _ in range(4)] + \
               [{"start": 0, "end": 60 * 60, "wh": 1500, "program": "quick", "clean": True}, {"start": 0, "end": 99, "wh": 5, "clean": False}]
    assert m.typical() == {"program": "Eco 50°", "n": 4, "minutes": 180, "kwh": 0.9}
    m.cycles = m.cycles[:2]
    assert m.typical() is None  # too few to say

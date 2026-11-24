"""Machines are found by name - the more particular words first."""

from custom_components.appliance_watch.hub import guess_kind


def test_names_in_many_languages():
    assert guess_kind("sensor.vaske_tørremaskine_power") == "washer_dryer"
    assert guess_kind("Waschtrockner Leistung") == "washer_dryer"
    assert guess_kind("sensor.vaskemaskine_power") == "washer"
    assert guess_kind("Tørretumbler") == "dryer"
    assert guess_kind("sensor.bambu_lab_p1s_power") == "printer"
    assert guess_kind("3D printer plug") == "printer"
    assert guess_kind("sensor.affugter_kaelder_effekt") == "dehumidifier"
    assert guess_kind("Fryser garage") == "freezer"
    assert guess_kind("Kühlschrank") == "freezer"
    assert guess_kind("sensor.airfryer_power") == "oven"
    assert guess_kind("Kaffemaskine") == "coffee"
    assert guess_kind("sensor.opvaskemaskine_effekt") == "dishwasher"
    assert guess_kind("sensor.stue_lampe_power") == "other"


def test_short_words_inside_other_words_are_not_a_machine():
    assert guess_kind("sensor.blender_power") == "other"  # not "ender" (a 3D printer)
    assert guess_kind("sensor.plug_four_power") == "other"  # not "four" (French oven)
    assert guess_kind("sensor.ovenpa_lampe_power") == "other"  # "ovenpå" is upstairs
    assert guess_kind("Hækklipper") == "other"
    assert guess_kind("Skylight") == "other"
    assert guess_kind("Creality Ender 3") == "printer"
    assert guess_kind("sensor.ender3_power") == "printer"
    assert guess_kind("Four") == "oven"
    assert guess_kind("Kummefryser") == "freezer"
    assert guess_kind("Kylskåp") == "freezer"
    assert guess_kind("Bageovn") == "oven"

"""Fixtures for Appliance Watch tests."""

import json
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def readings(kind: str) -> list[tuple[int, float | None]]:
    """Real power readings from a smart plug: [timestamp, W or None (unavailable)]."""
    return [tuple(x) for x in json.loads((FIXTURES / f"{kind}.json").read_text())]

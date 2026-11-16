"""Canonical Bank/Cash transfer directions shared with the desktop renderer."""

import json
import re
from pathlib import Path
from typing import Any

_RULES_PATH = Path(__file__).with_name("transfer_direction_rules.json")
with _RULES_PATH.open(encoding="utf-8") as _rules_file:
    _DIRECTIONS = json.load(_rules_file)["directions"]


def _normalize_alias(value: Any) -> str:
    normalized = str(value or "").strip().casefold()
    normalized = normalized.replace("→", " to ").replace("->", " to ")
    normalized = re.sub(r"[_-]+", " ", normalized)
    return " ".join(normalized.split())


_ALIAS_TO_DIRECTION = {
    _normalize_alias(alias): direction["value"]
    for direction in _DIRECTIONS
    for alias in [direction["value"], *direction["aliases"]]
}
_DIRECTION_RULES = {direction["value"]: direction for direction in _DIRECTIONS}


def normalize_transfer_direction(value: Any) -> str:
    """Return the canonical direction, or an empty string when it is invalid."""
    return _ALIAS_TO_DIRECTION.get(_normalize_alias(value), "")


def _direction_rule(direction: Any) -> dict:
    canonical = normalize_transfer_direction(direction)
    if not canonical:
        raise ValueError("Choose Bank to Cash or Cash to Bank.")
    return _DIRECTION_RULES[canonical]


def origin_flow(direction: Any) -> str:
    return _direction_rule(direction)["origin_flow"]


def destination_flow(direction: Any) -> str:
    return _direction_rule(direction)["destination_flow"]


def transfer_flow_label(direction: Any, flow: str) -> str:
    rule = _direction_rule(direction)
    if flow == rule["origin_flow"]:
        return rule["origin_label"]
    if flow == rule["destination_flow"]:
        return rule["destination_label"]
    raise ValueError("flow must be either bank or cash.")

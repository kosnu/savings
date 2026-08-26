"""Validate and resolve machine-readable AIDD review rule coverage."""

from __future__ import annotations

from fnmatch import fnmatchcase
from functools import lru_cache
from pathlib import PurePosixPath
from typing import Any


class RuleCoverageError(ValueError):
    pass


def validate_path_pattern(pattern: str, label: str) -> str:
    if not isinstance(pattern, str) or not pattern or pattern != pattern.strip():
        raise RuleCoverageError(f"{label} must be an exact path pattern")
    if "\\" in pattern:
        raise RuleCoverageError(f"{label} must use POSIX separators")
    parsed = PurePosixPath(pattern)
    if parsed.is_absolute() or pattern != parsed.as_posix() or any(
        part in {"", ".", ".."} for part in parsed.parts
    ):
        raise RuleCoverageError(f"{label} must be a normalized repository path pattern")
    if any("**" in part and part != "**" for part in parsed.parts):
        raise RuleCoverageError(f"{label} may use ** only as a complete path segment")
    for part in parsed.parts:
        index = 0
        while index < len(part):
            if part[index] == "]":
                raise RuleCoverageError(f"{label} has an unmatched ] character")
            if part[index] != "[":
                index += 1
                continue
            cursor = index + 1
            if cursor < len(part) and part[cursor] in {"!", "^"}:
                cursor += 1
            if cursor < len(part) and part[cursor] == "]":
                cursor += 1
            closing = part.find("]", cursor)
            if closing == -1 or closing == cursor:
                raise RuleCoverageError(f"{label} has an invalid character class")
            index = closing + 1
    return pattern


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RuleCoverageError(f"{label} must be a non-empty string")
    return value.strip()


def validate_review_routing(
    rule_map: dict[str, Any],
    rules_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    routing = rule_map.get("review_routing")
    if not isinstance(routing, dict) or set(routing) != {
        "governed_paths",
        "surfaces",
    }:
        raise RuleCoverageError(
            "rule-map.review_routing must contain only governed_paths and surfaces"
        )

    governed_paths = routing["governed_paths"]
    if not isinstance(governed_paths, list) or not governed_paths:
        raise RuleCoverageError("review_routing.governed_paths must be a non-empty array")
    for index, pattern in enumerate(governed_paths):
        validate_path_pattern(pattern, f"review_routing.governed_paths[{index}]")

    surfaces = routing["surfaces"]
    if not isinstance(surfaces, list) or not surfaces:
        raise RuleCoverageError("review_routing.surfaces must be a non-empty array")
    surface_ids: set[str] = set()
    for index, surface in enumerate(surfaces):
        label = f"review_routing.surfaces[{index}]"
        if not isinstance(surface, dict) or set(surface) != {
            "id",
            "paths",
            "required_rules",
        }:
            raise RuleCoverageError(
                f"{label} must contain only id, paths, and required_rules"
            )
        surface_id = require_string(surface["id"], f"{label}.id")
        if surface_id in surface_ids:
            raise RuleCoverageError(f"duplicate review surface: {surface_id}")
        surface_ids.add(surface_id)
        paths = surface["paths"]
        if not isinstance(paths, list) or not paths:
            raise RuleCoverageError(f"{surface_id}.paths must be a non-empty array")
        for path_index, pattern in enumerate(paths):
            validate_path_pattern(pattern, f"{surface_id}.paths[{path_index}]")
        required_rules = surface["required_rules"]
        if not isinstance(required_rules, list) or not required_rules or any(
            not isinstance(rule_id, str) or not rule_id.strip()
            for rule_id in required_rules
        ):
            raise RuleCoverageError(
                f"{surface_id}.required_rules must be a non-empty array"
            )
        if len(required_rules) != len(set(required_rules)):
            raise RuleCoverageError(f"{surface_id}.required_rules must be unique")
        unknown = set(required_rules) - set(rules_by_id)
        if unknown:
            raise RuleCoverageError(
                f"{surface_id}.required_rules contains unknown nodes: "
                f"{', '.join(sorted(unknown))}"
            )
    for rule_id, rule in rules_by_id.items():
        for index, pattern in enumerate(rule["applies_to"].get("paths", [])):
            validate_path_pattern(pattern, f"{rule_id}.applies_to.paths[{index}]")
    return routing


def surface_ids(routing: dict[str, Any]) -> list[str]:
    return [surface["id"] for surface in routing["surfaces"]]


def matches_path(path: str, pattern: str) -> bool:
    normalized = PurePosixPath(path).as_posix()
    path_parts = PurePosixPath(normalized).parts
    pattern_parts = PurePosixPath(
        validate_path_pattern(pattern, "path pattern")
    ).parts

    @lru_cache(maxsize=None)
    def match(pattern_index: int, path_index: int) -> bool:
        if pattern_index == len(pattern_parts):
            return path_index == len(path_parts)
        segment = pattern_parts[pattern_index]
        if segment == "**":
            return match(pattern_index + 1, path_index) or (
                path_index < len(path_parts) and match(pattern_index, path_index + 1)
            )
        return (
            path_index < len(path_parts)
            and fnmatchcase(path_parts[path_index], segment)
            and match(pattern_index + 1, path_index + 1)
        )

    return match(0, 0)


def path_is_governed(path: str, routing: dict[str, Any]) -> bool:
    return any(matches_path(path, pattern) for pattern in routing["governed_paths"])


def matching_surfaces(path: str, routing: dict[str, Any]) -> list[str]:
    return [
        surface["id"]
        for surface in routing["surfaces"]
        if any(matches_path(path, pattern) for pattern in surface["paths"])
    ]


def rules_for_surfaces(
    selected_surfaces: list[str],
    routing: dict[str, Any],
) -> list[str]:
    selected = set(selected_surfaces)
    return list(
        dict.fromkeys(
            rule_id
            for surface in routing["surfaces"]
            if surface["id"] in selected
            for rule_id in surface["required_rules"]
        )
    )


def rules_for_path(
    path: str,
    rules_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    return [
        rule_id
        for rule_id, rule in rules_by_id.items()
        if any(
            matches_path(path, pattern)
            for pattern in rule["applies_to"].get("paths", [])
        )
    ]


def resolve_path_coverage(
    path: str,
    routing: dict[str, Any],
    rules_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    governed = path_is_governed(path, routing)
    surfaces = matching_surfaces(path, routing) if governed else []
    if governed and not surfaces:
        raise RuleCoverageError(f"governed path has no review surface: {path}")
    return {
        "path": path,
        "governed": governed,
        "surfaces": surfaces,
        "path_rules": rules_for_path(path, rules_by_id),
    }


def expand_rule_closure(
    direct_rule_ids: list[str],
    rules_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    selected: set[str] = set()
    pending = list(reversed(direct_rule_ids))
    while pending:
        rule_id = pending.pop()
        if rule_id in selected:
            continue
        rule = rules_by_id.get(rule_id)
        if rule is None:
            raise RuleCoverageError(f"unknown rule-map node: {rule_id}")
        selected.add(rule_id)
        dependencies = rule.get("depends_on", [])
        for dependency in reversed(dependencies):
            if dependency not in rules_by_id:
                raise RuleCoverageError(
                    f"unknown rule-map dependency: {rule_id} -> {dependency}"
                )
            pending.append(dependency)
    return [rule_id for rule_id in rules_by_id if rule_id in selected]

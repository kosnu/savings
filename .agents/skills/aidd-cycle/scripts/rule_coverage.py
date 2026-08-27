"""Compile and resolve machine-readable AIDD review rule coverage."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import PurePosixPath
from typing import Any


class RuleCoverageError(ValueError):
    pass


@dataclass(frozen=True)
class LiteralToken:
    value: str


@dataclass(frozen=True)
class AnyCharacterToken:
    pass


@dataclass(frozen=True)
class AnyCharactersToken:
    pass


@dataclass(frozen=True)
class CharacterClassToken:
    negated: bool
    literals: frozenset[str]
    ranges: tuple[tuple[str, str], ...]

    def matches(self, character: str) -> bool:
        included = character in self.literals or any(
            start <= character <= end for start, end in self.ranges
        )
        return not included if self.negated else included


SegmentToken = (
    LiteralToken | AnyCharacterToken | AnyCharactersToken | CharacterClassToken
)


@dataclass(frozen=True)
class SegmentPattern:
    tokens: tuple[SegmentToken, ...]

    def matches(self, value: str) -> bool:
        @lru_cache(maxsize=None)
        def match(token_index: int, character_index: int) -> bool:
            if token_index == len(self.tokens):
                return character_index == len(value)
            token = self.tokens[token_index]
            if isinstance(token, AnyCharactersToken):
                return match(token_index + 1, character_index) or (
                    character_index < len(value)
                    and match(token_index, character_index + 1)
                )
            if character_index == len(value):
                return False
            character = value[character_index]
            if isinstance(token, LiteralToken):
                accepted = token.value == character
            elif isinstance(token, AnyCharacterToken):
                accepted = True
            else:
                accepted = token.matches(character)
            return accepted and match(token_index + 1, character_index + 1)

        return match(0, 0)


@dataclass(frozen=True)
class DoubleStarPattern:
    pass


PathSegmentPattern = SegmentPattern | DoubleStarPattern
DOUBLE_STAR = DoubleStarPattern()


@dataclass(frozen=True)
class CompiledPathPattern:
    source: str
    segments: tuple[PathSegmentPattern, ...]

    def matches(self, path: str) -> bool:
        parsed = PurePosixPath(path)
        if (
            not path
            or parsed.is_absolute()
            or path != parsed.as_posix()
            or any(part in {"", ".", ".."} for part in parsed.parts)
        ):
            raise RuleCoverageError("matched path must be a normalized repository path")
        path_parts = parsed.parts

        @lru_cache(maxsize=None)
        def match(pattern_index: int, path_index: int) -> bool:
            if pattern_index == len(self.segments):
                return path_index == len(path_parts)
            segment = self.segments[pattern_index]
            if isinstance(segment, DoubleStarPattern):
                return match(pattern_index + 1, path_index) or (
                    path_index < len(path_parts)
                    and match(pattern_index, path_index + 1)
                )
            return (
                path_index < len(path_parts)
                and segment.matches(path_parts[path_index])
                and match(pattern_index + 1, path_index + 1)
            )

        return match(0, 0)


@dataclass(frozen=True)
class CompiledSurface:
    id: str
    paths: tuple[CompiledPathPattern, ...]
    required_rules: tuple[str, ...]


@dataclass(frozen=True)
class CompiledRuleCoverage:
    governed_paths: tuple[CompiledPathPattern, ...]
    surfaces: tuple[CompiledSurface, ...]
    rule_paths: tuple[tuple[str, tuple[CompiledPathPattern, ...]], ...]


def _parse_character_class(
    segment: str,
    start_index: int,
    label: str,
) -> tuple[CharacterClassToken, int]:
    cursor = start_index + 1
    negated = cursor < len(segment) and segment[cursor] == "!"
    if negated:
        cursor += 1
    characters: list[str] = []
    if cursor < len(segment) and segment[cursor] == "]":
        characters.append("]")
        cursor += 1
    while cursor < len(segment) and segment[cursor] != "]":
        characters.append(segment[cursor])
        cursor += 1
    if cursor == len(segment) or not characters:
        raise RuleCoverageError(f"{label} has an invalid character class")

    literals: set[str] = set()
    ranges: list[tuple[str, str]] = []
    index = 0
    while index < len(characters):
        character = characters[index]
        if index + 2 < len(characters) and characters[index + 1] == "-":
            end = characters[index + 2]
            if character == "-" or end == "-" or character > end:
                raise RuleCoverageError(f"{label} has an invalid character class range")
            ranges.append((character, end))
            index += 3
            continue
        if character == "-" and index not in {0, len(characters) - 1}:
            raise RuleCoverageError(f"{label} has an invalid character class range")
        literals.add(character)
        index += 1
    return (
        CharacterClassToken(
            negated=negated,
            literals=frozenset(literals),
            ranges=tuple(ranges),
        ),
        cursor + 1,
    )


def _compile_segment(segment: str, label: str) -> SegmentPattern:
    tokens: list[SegmentToken] = []
    index = 0
    while index < len(segment):
        character = segment[index]
        if character == "*":
            if not tokens or not isinstance(tokens[-1], AnyCharactersToken):
                tokens.append(AnyCharactersToken())
            index += 1
            continue
        if character == "?":
            tokens.append(AnyCharacterToken())
            index += 1
            continue
        if character == "[":
            token, index = _parse_character_class(segment, index, label)
            tokens.append(token)
            continue
        if character == "]":
            raise RuleCoverageError(f"{label} has an unmatched ] character")
        tokens.append(LiteralToken(character))
        index += 1
    return SegmentPattern(tuple(tokens))


def validate_path_pattern(pattern: str, label: str) -> CompiledPathPattern:
    if not isinstance(pattern, str) or not pattern or pattern != pattern.strip():
        raise RuleCoverageError(f"{label} must be an exact path pattern")
    if "\\" in pattern:
        raise RuleCoverageError(f"{label} must use POSIX separators")
    parsed = PurePosixPath(pattern)
    if parsed.is_absolute() or pattern != parsed.as_posix() or any(
        part in {"", ".", ".."} for part in parsed.parts
    ):
        raise RuleCoverageError(f"{label} must be a normalized repository path pattern")
    segments: list[PathSegmentPattern] = []
    for part in parsed.parts:
        if "**" in part and part != "**":
            raise RuleCoverageError(f"{label} may use ** only as a complete path segment")
        segments.append(DOUBLE_STAR if part == "**" else _compile_segment(part, label))
    return CompiledPathPattern(source=pattern, segments=tuple(segments))


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RuleCoverageError(f"{label} must be a non-empty string")
    return value.strip()


def validate_review_routing(
    rule_map: dict[str, Any],
    rules_by_id: dict[str, dict[str, Any]],
) -> CompiledRuleCoverage:
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
    compiled_governed_paths = tuple(
        validate_path_pattern(pattern, f"review_routing.governed_paths[{index}]")
        for index, pattern in enumerate(governed_paths)
    )

    surfaces = routing["surfaces"]
    if not isinstance(surfaces, list) or not surfaces:
        raise RuleCoverageError("review_routing.surfaces must be a non-empty array")
    surface_ids: set[str] = set()
    compiled_surfaces: list[CompiledSurface] = []
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
        compiled_paths = tuple(
            validate_path_pattern(pattern, f"{surface_id}.paths[{path_index}]")
            for path_index, pattern in enumerate(paths)
        )
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
        compiled_surfaces.append(
            CompiledSurface(
                id=surface_id,
                paths=compiled_paths,
                required_rules=tuple(required_rules),
            )
        )

    compiled_rule_paths = tuple(
        (
            rule_id,
            tuple(
                validate_path_pattern(pattern, f"{rule_id}.applies_to.paths[{index}]")
                for index, pattern in enumerate(rule["applies_to"].get("paths", []))
            ),
        )
        for rule_id, rule in rules_by_id.items()
    )
    return CompiledRuleCoverage(
        governed_paths=compiled_governed_paths,
        surfaces=tuple(compiled_surfaces),
        rule_paths=compiled_rule_paths,
    )


def surface_ids(routing: CompiledRuleCoverage) -> list[str]:
    return [surface.id for surface in routing.surfaces]


def matches_path(path: str, pattern: CompiledPathPattern) -> bool:
    return pattern.matches(path)


def path_is_governed(path: str, routing: CompiledRuleCoverage) -> bool:
    return any(pattern.matches(path) for pattern in routing.governed_paths)


def matching_surfaces(path: str, routing: CompiledRuleCoverage) -> list[str]:
    return [
        surface.id
        for surface in routing.surfaces
        if any(pattern.matches(path) for pattern in surface.paths)
    ]


def rules_for_surfaces(
    selected_surfaces: list[str],
    routing: CompiledRuleCoverage,
) -> list[str]:
    selected = set(selected_surfaces)
    return list(
        dict.fromkeys(
            rule_id
            for surface in routing.surfaces
            if surface.id in selected
            for rule_id in surface.required_rules
        )
    )


def rules_for_path(
    path: str,
    routing: CompiledRuleCoverage,
) -> list[str]:
    return [
        rule_id
        for rule_id, patterns in routing.rule_paths
        if any(pattern.matches(path) for pattern in patterns)
    ]


def resolve_path_coverage(
    path: str,
    routing: CompiledRuleCoverage,
) -> dict[str, Any]:
    governed = path_is_governed(path, routing)
    surfaces = matching_surfaces(path, routing) if governed else []
    if governed and not surfaces:
        raise RuleCoverageError(f"governed path has no review surface: {path}")
    return {
        "path": path,
        "governed": governed,
        "surfaces": surfaces,
        "path_rules": rules_for_path(path, routing),
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

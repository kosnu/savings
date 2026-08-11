"""Requirement identifier helpers for structured AIDD validation."""

from __future__ import annotations

import re


REQUIREMENT_ID_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_-])(?P<prefix>FR|NFR|AC)-(?P<number>[1-9][0-9]*)"
    r"(?![A-Za-z0-9_-])"
)
PREFIX_ORDER = {"FR": 0, "NFR": 1, "AC": 2}
REQUIRED_REQUIREMENTS_SECTIONS = {
    "background": ("背景", "background"),
    "users": ("対象ユーザー", "target users"),
    "stories": ("ユーザーストーリー", "user stories"),
    "scope": ("スコープ", "scope"),
    "functional": ("機能要件", "functional requirements"),
    "non_functional": (
        "非機能要件",
        "non-functional requirements",
        "non functional requirements",
    ),
    "acceptance": ("受け入れ条件", "acceptance criteria"),
    "qa": ("q&a", "q＆a", "qa log"),
    "technical": ("技術的考慮事項", "technical considerations"),
}


def requirement_sort_key(requirement_id: str) -> tuple[int, int]:
    prefix, number = requirement_id.split("-", 1)
    return PREFIX_ORDER[prefix], int(number)


def is_requirement_id(value: str) -> bool:
    return REQUIREMENT_ID_PATTERN.fullmatch(value) is not None


def extract_requirement_mentions(value: str) -> list[str]:
    return sorted(
        {match.group(0) for match in REQUIREMENT_ID_PATTERN.finditer(value)},
        key=requirement_sort_key,
    )


def normalize_structured_text(value: str) -> str:
    return " ".join(value.split()).casefold()

"""Canonical Requirements section aliases shared by structured validators."""

from __future__ import annotations

import re


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

EXACT_REQUIREMENTS_SECTION_HEADINGS = {
    "background": (
        "背景",
        "背景と課題",
        "background",
        "background / current state",
    ),
    "users": (
        "対象ユーザー",
        "対象ユーザーと利用シーン",
        "target users",
        "target users and use cases",
    ),
    "stories": ("ユーザーストーリー", "user stories"),
    "scope": ("スコープ", "scope"),
    "functional": ("機能要件", "functional requirements"),
    "non-functional": (
        "非機能要件",
        "非機能要件と制約",
        "non-functional requirements",
        "non functional requirements",
        "non-functional requirements / constraints",
        "non-functional requirements and constraints",
    ),
    "acceptance": ("受け入れ条件", "acceptance criteria"),
    "qa": ("q&a", "q＆a", "q&aログ", "q&a log", "qa log"),
    "technical": ("技術的考慮事項", "technical considerations"),
}


def normalize_structured_text(value: str) -> str:
    return " ".join(value.split()).casefold()


def _heading_segments(heading: str) -> tuple[str, ...]:
    normalized_heading = normalize_structured_text(heading)
    return tuple(
        segment.strip()
        for segment in re.split(r"[/／|｜・]", normalized_heading)
    )


def requirement_section_ids_for_heading(heading: str) -> tuple[str, ...]:
    segments = _heading_segments(heading)
    return tuple(
        section_id
        for section_id, aliases in REQUIRED_REQUIREMENTS_SECTIONS.items()
        if any(
            segment.startswith(normalize_structured_text(alias))
            for segment in segments
            for alias in aliases
        )
    )


def exact_requirement_section_ids_for_heading(heading: str) -> tuple[str, ...]:
    """Match managed-v2 headings against the explicit canonical allowlist."""

    normalized_heading = normalize_structured_text(heading)
    direct_matches = tuple(
        section_id
        for section_id, aliases in EXACT_REQUIREMENTS_SECTION_HEADINGS.items()
        if normalized_heading
        in {normalize_structured_text(alias) for alias in aliases}
    )
    if direct_matches:
        return direct_matches

    matched_section_ids: list[str] = []
    for segment in _heading_segments(heading):
        segment_matches = tuple(
            section_id
            for section_id, aliases in EXACT_REQUIREMENTS_SECTION_HEADINGS.items()
            if segment in {normalize_structured_text(alias) for alias in aliases}
        )
        if len(segment_matches) != 1:
            return ()
        matched_section_ids.append(segment_matches[0])
    return tuple(matched_section_ids)


def canonical_requirement_section_ids_for_heading(heading: str) -> tuple[str, ...]:
    """Match legacy headings while normalizing the historical section ID."""

    return tuple(
        "non-functional" if section_id == "non_functional" else section_id
        for section_id in requirement_section_ids_for_heading(heading)
    )

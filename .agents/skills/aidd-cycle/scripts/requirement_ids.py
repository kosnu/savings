"""Shared Markdown structure helpers for AIDD artifact gates."""

from __future__ import annotations

import re
from dataclasses import dataclass


REQUIREMENT_ID_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_-])(?P<prefix>FR|NFR|AC)-(?P<number>[1-9][0-9]*)"
    r"(?![A-Za-z0-9_-])"
)
REQUIREMENT_DEFINITION_PATTERN = re.compile(
    r"(?m)^(?P<indent>[ \t]*)(?P<marker>#{2,6}|[-*+])[ \t]+(?:\*\*)?"
    r"(?P<requirement_id>(?:FR|NFR|AC)-[1-9][0-9]*)"
    r"(?![A-Za-z0-9_-])(?P<summary>[^\n]*)"
)
PREFIX_ORDER = {"FR": 0, "NFR": 1, "AC": 2}
MACHINE_GATE_PATTERN = re.compile(
    r"(?ms)^## (?:Requirements Input Gate|Requirements Completeness Gate|"
    r"Design Coverage Gate)\s*$.*?```json\s*\n.*?\n```"
)
LEVEL_TWO_SECTION_PATTERN = re.compile(
    r"(?ms)^## (?!#)(?P<heading>[^\n]+)\n(?P<body>.*?)(?=^## (?!#)|\Z)"
)
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


@dataclass(frozen=True)
class RequirementItem:
    requirement_id: str
    content: str


@dataclass(frozen=True)
class DocumentSection:
    heading: str
    body: str

    @property
    def content(self) -> str:
        return f"## {self.heading}\n{self.body}".strip()


def requirement_sort_key(requirement_id: str) -> tuple[int, int]:
    prefix, number = requirement_id.split("-", 1)
    return PREFIX_ORDER[prefix], int(number)


def strip_machine_gates(document: str) -> str:
    return MACHINE_GATE_PATTERN.sub("", document)


def extract_requirement_mentions(document: str) -> list[str]:
    document = strip_machine_gates(document)
    return sorted(
        {match.group(0) for match in REQUIREMENT_ID_PATTERN.finditer(document)},
        key=requirement_sort_key,
    )


def extract_requirement_definitions(document: str) -> list[str]:
    return sorted(extract_requirement_items(document), key=requirement_sort_key)


def normalize_markdown_text(value: str) -> str:
    return " ".join(value.split()).casefold()


def extract_requirement_items(document: str) -> dict[str, RequirementItem]:
    document = strip_machine_gates(document)
    matches = list(REQUIREMENT_DEFINITION_PATTERN.finditer(document))
    items: dict[str, RequirementItem] = {}
    for index, match in enumerate(matches):
        requirement_id = match.group("requirement_id")
        if requirement_id in items:
            raise ValueError(f"duplicate requirement definition: {requirement_id}")

        marker = match.group("marker")
        if marker.startswith("#"):
            heading_level = len(marker)
            end = len(document)
            for heading in re.finditer(r"(?m)^(?P<marker>#{1,6})[ \t]+", document[match.end():]):
                if len(heading.group("marker")) <= heading_level:
                    end = match.end() + heading.start()
                    break
            content = document[match.start():end].strip()
        else:
            line_end = document.find("\n", match.start())
            if line_end == -1:
                line_end = len(document)
            content = document[match.start():line_end].strip()

        summary = re.sub(r"^[\s:*：*_`-]+|[\s*`]+$", "", match.group("summary"))
        if len(normalize_markdown_text(summary)) < 2:
            raise ValueError(
                f"requirement definition must have a substantive summary: {requirement_id}"
            )
        items[requirement_id] = RequirementItem(requirement_id, content)
    return items


def extract_level_two_sections(document: str) -> list[DocumentSection]:
    document = strip_machine_gates(document)
    sections: list[DocumentSection] = []
    for match in LEVEL_TWO_SECTION_PATTERN.finditer(document):
        heading = match.group("heading").strip()
        body = match.group("body").strip()
        if heading in {
            "Requirements Input Gate",
            "Requirements Completeness Gate",
            "Design Coverage Gate",
        }:
            continue
        sections.append(DocumentSection(heading, body))
    return sections


def extract_required_requirements_sections(
    document: str,
    *,
    require_all: bool = True,
) -> dict[str, DocumentSection]:
    sections = extract_level_two_sections(document)
    normalized_sections = [
        (
            section,
            normalize_markdown_text(section.heading),
            normalize_markdown_text(section.body),
        )
        for section in sections
    ]
    matched_sections: dict[str, DocumentSection] = {}
    for section_id, aliases in REQUIRED_REQUIREMENTS_SECTIONS.items():
        matches = [
            (section, content)
            for section, heading, content in normalized_sections
            if any(alias in heading for alias in aliases)
            and not (
                section_id == "functional"
                and (
                    "非機能" in heading
                    or "non-functional" in heading
                    or "non functional" in heading
                )
            )
        ]
        if not matches and not require_all:
            continue
        if len(matches) != 1:
            raise ValueError(
                f"Requirements must contain exactly one {section_id} section"
            )
        section, content = matches[0]
        if len(content) < 2:
            raise ValueError(f"Requirements section is empty: {section_id}")
        matched_sections[section_id] = section
    return matched_sections


def validate_required_requirements_sections(document: str) -> None:
    extract_required_requirements_sections(document)


def is_requirement_id(value: str) -> bool:
    return REQUIREMENT_ID_PATTERN.fullmatch(value) is not None

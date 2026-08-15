"""Shared Markdown structure helpers for AIDD artifact gates."""

from __future__ import annotations

import re
from dataclasses import dataclass

from structured_ids import (
    REQUIRED_REQUIREMENTS_SECTIONS,
    REQUIREMENT_ID_PATTERN,
    is_requirement_id,
    mask_non_rendered_markdown as mask_legacy_markdown,
    requirement_sort_key,
)

REQUIREMENT_DEFINITION_PATTERN = re.compile(
    r"(?m)^(?P<indent>[ \t]*)(?P<marker>#{2,6}|[-*+])[ \t]+(?:\*\*)?"
    r"(?P<requirement_id>(?:FR|NFR|AC)-[1-9][0-9]*)"
    r"(?![A-Za-z0-9_-])(?P<summary>[^\n]*)"
)
MACHINE_GATE_PATTERN = re.compile(
    r"(?ms)^## (?:Requirements Input Gate|Requirements Completeness Gate|"
    r"Design Coverage Gate)\s*$.*?```json\s*\n.*?\n```"
)
LEVEL_TWO_SECTION_PATTERN = re.compile(
    r"(?ms)^## (?!#)(?P<heading>[^\n]+)\n(?P<body>.*?)(?=^## (?!#)|\Z)"
)
FENCED_CODE_OPEN_PATTERN = re.compile(
    r"^(?P<indent> {0,3})(?P<fence>`{3,}|~{3,})(?P<info>[^\r\n]*)$"
)
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


def strip_machine_gates(document: str) -> str:
    return MACHINE_GATE_PATTERN.sub("", document)


def mask_non_rendered_markdown(document: str) -> str:
    return mask_legacy_markdown(document)

def extract_requirement_mentions(document: str) -> list[str]:
    document = strip_machine_gates(document)
    document = mask_non_rendered_markdown(document)
    return sorted(
        {match.group(0) for match in REQUIREMENT_ID_PATTERN.finditer(document)},
        key=requirement_sort_key,
    )


def extract_requirement_definitions(document: str) -> list[str]:
    return sorted(extract_requirement_items(document), key=requirement_sort_key)


def normalize_markdown_text(value: str) -> str:
    return " ".join(value.split()).casefold()


def indentation_width(value: str) -> int:
    return len(value.expandtabs(4))


def bullet_item_end(document: str, match: re.Match[str]) -> int:
    first_line_end = document.find("\n", match.start())
    if first_line_end == -1:
        return len(document)

    parent_indent = indentation_width(match.group("indent"))
    content_end = first_line_end
    line_start = first_line_end + 1
    while line_start < len(document):
        line_end = document.find("\n", line_start)
        if line_end == -1:
            line_end = len(document)
        line = document[line_start:line_end]
        if not line.strip():
            content_end = line_end
            line_start = line_end + 1
            continue

        leading = re.match(r"[ \t]*", line)
        assert leading is not None
        if indentation_width(leading.group(0)) <= parent_indent:
            break

        content_end = line_end
        line_start = line_end + 1
    return content_end


def extract_requirement_items(document: str) -> dict[str, RequirementItem]:
    document = strip_machine_gates(document)
    structure = mask_non_rendered_markdown(document)
    matches = list(REQUIREMENT_DEFINITION_PATTERN.finditer(structure))
    items: dict[str, RequirementItem] = {}
    for index, match in enumerate(matches):
        requirement_id = match.group("requirement_id")
        if requirement_id in items:
            raise ValueError(f"duplicate requirement definition: {requirement_id}")

        marker = match.group("marker")
        if marker.startswith("#"):
            heading_level = len(marker)
            end = len(document)
            for heading in re.finditer(
                r"(?m)^(?P<marker>#{1,6})[ \t]+",
                structure[match.end():],
            ):
                if len(heading.group("marker")) <= heading_level:
                    end = match.end() + heading.start()
                    break
            content = document[match.start():end].strip()
        else:
            end = bullet_item_end(document, match)
            content = document[match.start():end].strip()

        summary = re.sub(r"^[\s:*：*_`-]+|[\s*`]+$", "", match.group("summary"))
        if len(normalize_markdown_text(summary)) < 2:
            raise ValueError(
                f"requirement definition must have a substantive summary: {requirement_id}"
            )
        items[requirement_id] = RequirementItem(requirement_id, content)
    return items


def extract_level_two_sections(document: str) -> list[DocumentSection]:
    document = strip_machine_gates(document)
    structure = mask_non_rendered_markdown(document)
    sections: list[DocumentSection] = []
    for match in LEVEL_TWO_SECTION_PATTERN.finditer(structure):
        heading = document[match.start("heading") : match.end("heading")].strip()
        body = document[match.start("body") : match.end("body")].strip()
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
            index,
            section,
            normalize_markdown_text(section.heading),
            normalize_markdown_text(section.body),
        )
        for index, section in enumerate(sections)
    ]
    matched_sections: dict[str, DocumentSection] = {}
    assigned_sections: dict[int, str] = {}
    for section_id, aliases in REQUIRED_REQUIREMENTS_SECTIONS.items():
        matches = [
            (index, section, content)
            for index, section, heading, content in normalized_sections
            if any(
                any(
                    segment.strip().startswith(alias)
                    for segment in re.split(r"[/／|｜・]", heading)
                )
                for alias in aliases
            )
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
        section_index, section, content = matches[0]
        if section_index in assigned_sections:
            raise ValueError(
                "Requirements sections must map one-to-one to headings: "
                f"{assigned_sections[section_index]} and {section_id}"
            )
        assigned_sections[section_index] = section_id
        if len(content) < 2:
            raise ValueError(f"Requirements section is empty: {section_id}")
        matched_sections[section_id] = section
    return matched_sections


def legacy_requirements_inventory(
    document: str,
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Extract the deterministic legacy Requirements inventory."""

    items = extract_requirement_items(document)
    sections = extract_required_requirements_sections(document, require_all=False)
    return (
        [
            {"id": requirement_id, "content": items[requirement_id].content}
            for requirement_id in sorted(items, key=requirement_sort_key)
        ],
        [
            {
                "id": section_id,
                "heading": sections[section_id].heading,
                "content": sections[section_id].content,
            }
            for section_id in REQUIRED_REQUIREMENTS_SECTIONS
            if section_id in sections
        ],
    )


def legacy_design_inventory(document: str) -> list[dict[str, str]]:
    """Extract the deterministic legacy Design section inventory."""

    return [
        {"heading": section.heading, "content": section.content}
        for section in extract_level_two_sections(strip_machine_gates(document))
    ]


def validate_required_requirements_sections(document: str) -> None:
    extract_required_requirements_sections(document)

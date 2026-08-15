"""Requirement identifier helpers for structured AIDD validation."""

from __future__ import annotations

import re
from dataclasses import dataclass


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
FENCED_CODE_PATTERN = re.compile(
    r"^(?P<indent> {0,3})(?P<fence>`{3,}|~{3,})(?P<info>[^\r\n]*)$"
)
LIST_MARKER_PATTERN = re.compile(
    r"(?P<indent> {0,3})(?P<marker>[-+*]|[0-9]{1,9}[.)])(?P<spacing> +)"
)
ATX_LEVEL_TWO_PATTERN = re.compile(
    r"^ {0,3}##(?:[ \t]+|$)(?P<heading>.*?)(?:[ \t]+#+[ \t]*)?$"
)
ATX_LEVEL_ONE_PATTERN = re.compile(
    r"^ {0,3}#(?:[ \t]+|$)(?P<heading>.*?)(?:[ \t]+#+[ \t]*)?$"
)
SETEXT_LEVEL_TWO_PATTERN = re.compile(r"^ {0,3}-+[ \t]*$")
SETEXT_LEVEL_ONE_PATTERN = re.compile(r"^ {0,3}=+[ \t]*$")
ATX_HEADING_PATTERN = re.compile(r"^ {0,3}#{1,6}(?:[ \t]+|$)")
INLINE_BLOCK_BOUNDARY_PATTERN = re.compile(
    r"^ {0,3}(?:#{1,6}(?:[ \t]|$)|`{3,}|~{3,}|"
    r"<(?:!--|\?|!\[CDATA\[|/?[A-Za-z][A-Za-z0-9-]*"
    r"(?=[ \t\r\n/>]|$))|(?:[*_-][ \t]*){3,}$)"
)
INDENTED_CODE_BOUNDARY_PATTERN = re.compile(r"^(?: {0,3}\t| {4})")


def split_blockquote_prefix(content: str) -> tuple[int, str]:
    """Return the CommonMark blockquote depth and content after its markers."""

    depth = 0
    cursor = 0
    while True:
        marker = cursor
        while (
            marker < len(content)
            and marker - cursor < 3
            and content[marker] == " "
        ):
            marker += 1
        if marker >= len(content) or content[marker] != ">":
            return depth, content[cursor:]
        depth += 1
        cursor = marker + 1
        if cursor < len(content) and content[cursor] in " \t":
            cursor += 1


def split_list_prefix(content: str) -> tuple[int, str]:
    """Return list-content indentation and content after nested list markers."""

    cursor = 0
    while True:
        match = LIST_MARKER_PATTERN.match(content, cursor)
        if match is None:
            return cursor, content[cursor:]
        spacing = match.group("spacing")
        padding = len(spacing) if len(spacing) <= 4 else 1
        consumed = match.start("spacing") + padding
        cursor = consumed


def strip_explicit_container_markers(content: str) -> str:
    """Strip interleaved blockquote/list markers in their source order."""

    cursor = 0
    while cursor < len(content):
        marker = cursor
        while (
            marker < len(content)
            and marker - cursor < 3
            and content[marker] == " "
        ):
            marker += 1
        if marker < len(content) and content[marker] == ">":
            cursor = marker + 1
            if cursor < len(content) and content[cursor] in " \t":
                cursor += 1
            continue
        match = LIST_MARKER_PATTERN.match(content, cursor)
        if match is not None:
            spacing = match.group("spacing")
            padding = len(spacing) if len(spacing) <= 4 else 1
            cursor = match.start("spacing") + padding
            continue
        break
    return content[cursor:]


def markdown_container_lines(contents: list[str]) -> list[tuple[str, str | None]]:
    """Resolve blockquote and list-item continuation context for each line."""

    resolved: list[tuple[str, str | None]] = []
    active_lists: dict[str, tuple[int, str]] = {}
    active_list_paragraphs: set[str] = set()
    for index, content in enumerate(contents):
        layout = content.expandtabs(4)
        root_list = active_lists.get("root")
        if root_list is not None:
            content_indent, signature = root_list
            if leading_space_width(layout) >= content_indent:
                continuation = layout[content_indent:]
                if continuation.lstrip(" ").startswith(">"):
                    resolved.append(
                        (strip_explicit_container_markers(continuation), signature)
                    )
                    continue
            elif (
                signature in active_list_paragraphs
                and layout.strip()
                and LIST_MARKER_PATTERN.match(layout) is None
                and INLINE_BLOCK_BOUNDARY_PATTERN.match(layout) is None
            ):
                resolved.append((strip_explicit_container_markers(layout), signature))
                continue
            elif not layout.strip() or INLINE_BLOCK_BOUNDARY_PATTERN.match(layout):
                active_list_paragraphs.discard(signature)
        quote_depth, quote_content = split_blockquote_prefix(layout)
        quote_prefix_length = len(layout) - len(quote_content)
        quote_signature = f"quote:{quote_depth}" if quote_depth else "root"
        list_match = LIST_MARKER_PATTERN.match(quote_content)
        if list_match is not None:
            spacing = list_match.group("spacing")
            padding = len(spacing) if len(spacing) <= 4 else 1
            content_indent = list_match.start("spacing") + padding
            signature = f"{quote_signature}:list-item:{index}"
            active_lists[quote_signature] = (content_indent, signature)
            leaf = strip_explicit_container_markers(
                quote_content[content_indent:]
            )
            if leaf.strip():
                active_list_paragraphs.add(signature)
            resolved.append(
                (leaf, signature)
            )
            continue

        active_list = active_lists.get(quote_signature)
        if active_list is not None:
            content_indent, signature = active_list
            if leading_space_width(quote_content) >= content_indent:
                resolved.append(
                    (
                        strip_explicit_container_markers(
                            quote_content[content_indent:]
                        ),
                        signature,
                    )
                )
                continue
            if quote_content.strip():
                active_lists.pop(quote_signature, None)

        leaf = strip_explicit_container_markers(layout)
        if leaf != layout:
            signature = layout[: len(layout) - len(leaf)]
        elif quote_prefix_length:
            signature = quote_signature
        else:
            signature = None
        resolved.append((leaf, signature))
    lazy_signature: str | None = None
    for index, (leaf, signature) in enumerate(resolved):
        is_boundary = bool(
            not leaf.strip()
            or INLINE_BLOCK_BOUNDARY_PATTERN.match(leaf)
            or LIST_MARKER_PATTERN.match(leaf)
        )
        if signature is None and lazy_signature is not None and not is_boundary:
            signature = lazy_signature
            resolved[index] = (leaf, signature)
        if is_boundary:
            lazy_signature = None
        elif signature is not None:
            lazy_signature = signature
        else:
            lazy_signature = None
    return resolved


def visible_level_two_headings(document: str) -> list[tuple[int, str]]:
    """Return visible CommonMark level-two headings with source offsets."""

    masked = mask_block_markdown(document)
    lines = masked.splitlines(keepends=True)
    container_lines = markdown_container_lines(
        [line.rstrip("\r\n") for line in lines]
    )
    offsets: list[int] = []
    offset = 0
    for line in lines:
        offsets.append(offset)
        offset += len(line)
    front_matter_end = -1
    if lines and lines[0].strip() == "---":
        front_matter_end = next(
            (
                index
                for index, line in enumerate(lines[1:], start=1)
                if line.strip() == "---"
            ),
            -1,
        )
    headings: list[tuple[int, str]] = []
    paragraph_start: int | None = None
    paragraph_parts: list[str] = []
    container_paragraph = False
    container_start: int | None = None
    container_parts: list[str] = []
    container_signature: str | None = None
    for index, line in enumerate(lines):
        if index <= front_matter_end:
            continue
        content = line.rstrip("\r\n")
        layout = content.expandtabs(4)
        leaf_content, current_container_signature = container_lines[index]
        starts_container = current_container_signature is not None
        atx = ATX_LEVEL_TWO_PATTERN.fullmatch(leaf_content)
        if atx is not None:
            headings.append((offsets[index], atx.group("heading").strip()))
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = False
            container_start = None
            container_parts.clear()
            container_signature = None
            continue
        if ATX_HEADING_PATTERN.match(content) is not None:
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = False
            container_start = None
            container_parts.clear()
            container_signature = None
            continue
        if starts_container and SETEXT_LEVEL_TWO_PATTERN.fullmatch(
            leaf_content
        ) is not None:
            if (
                container_start is not None
                and container_signature == current_container_signature
            ):
                headings.append(
                    (container_start, " ".join(container_parts).strip())
                )
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = False
            container_start = None
            container_parts.clear()
            container_signature = None
            continue
        if SETEXT_LEVEL_TWO_PATTERN.fullmatch(content) is not None:
            if paragraph_start is not None and not container_paragraph:
                headings.append(
                    (paragraph_start, " ".join(paragraph_parts).strip())
                )
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = False
            container_start = None
            container_parts.clear()
            container_signature = None
            continue
        if SETEXT_LEVEL_ONE_PATTERN.fullmatch(content) is not None:
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = False
            container_start = None
            container_parts.clear()
            container_signature = None
            continue
        if not content.strip():
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = False
            container_start = None
            container_parts.clear()
            container_signature = None
            continue
        stripped_container = leaf_content
        ordered = re.match(
            r"^ {0,3}(?P<number>[0-9]{1,9})[.)][ \t]+",
            content,
        )
        if (
            starts_container
            and ordered is not None
            and int(ordered.group("number")) != 1
            and (paragraph_start is not None or container_paragraph)
        ):
            starts_container = False
        if starts_container:
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = bool(stripped_container.strip())
            if container_paragraph:
                if container_signature != current_container_signature:
                    container_start = offsets[index]
                    container_parts = []
                container_parts.append(stripped_container.strip())
                container_signature = current_container_signature
            else:
                container_start = None
                container_parts.clear()
                container_signature = None
            continue
        interrupts = bool(
            (
                len(layout) - len(layout.lstrip(" ")) >= 4
                and paragraph_start is None
                and not container_paragraph
            )
            or re.match(r"^ {0,3}(?:`{3,}|~{3,})", content)
            or re.match(
                r"^ {0,3}<(?:!--|\?|!\[CDATA\[|/?[A-Za-z][A-Za-z0-9-]*"
                r"(?=[ \t\r\n/>]|$))",
                content,
            )
            or (
                ordered is not None
                and (
                    (paragraph_start is None and not container_paragraph)
                    or int(ordered.group("number")) == 1
                )
            )
            or re.match(r"^ {0,3}(?:\*[ \t]*){3,}$", content)
            or re.match(r"^ {0,3}(?:_[ \t]*){3,}$", content)
        )
        if interrupts:
            paragraph_start = None
            paragraph_parts.clear()
            container_paragraph = False
            container_start = None
            container_parts.clear()
            container_signature = None
            continue
        if container_paragraph:
            continue
        if paragraph_start is None:
            paragraph_start = offsets[index]
        paragraph_parts.append(content.strip())
    return headings


def visible_level_one_headings(document: str) -> list[tuple[int, str]]:
    """Return visible CommonMark level-one headings with source offsets."""

    masked = mask_block_markdown(document)
    headings: list[tuple[int, str]] = []
    previous: tuple[int, str, str | None] | None = None
    offset = 0
    lines = masked.splitlines(keepends=True)
    container_lines = markdown_container_lines(
        [line.rstrip("\r\n") for line in lines]
    )
    front_matter_end = -1
    if lines and lines[0].strip() == "---":
        front_matter_end = next(
            (
                index
                for index, line in enumerate(lines[1:], start=1)
                if line.strip() == "---"
            ),
            -1,
        )
    for index, line in enumerate(lines):
        content = line.rstrip("\r\n")
        if index <= front_matter_end:
            offset += len(line)
            continue
        leaf, container_signature = container_lines[index]
        atx = ATX_LEVEL_ONE_PATTERN.fullmatch(leaf)
        if atx is not None:
            headings.append((offset, atx.group("heading").strip()))
            previous = None
        elif SETEXT_LEVEL_ONE_PATTERN.fullmatch(leaf) is not None:
            if previous is not None and previous[2] == container_signature:
                headings.append((previous[0], previous[1]))
            previous = None
        elif (
            not leaf.strip()
            or ATX_HEADING_PATTERN.match(leaf) is not None
            or INLINE_BLOCK_BOUNDARY_PATTERN.match(leaf) is not None
        ):
            previous = None
        else:
            previous = (offset, leaf.strip(), container_signature)
        offset += len(line)
    return headings


def leading_space_width(content: str) -> int:
    return len(content) - len(content.lstrip(" "))


def mask_range(masked: list[str], document: str, start: int, end: int) -> None:
    for index in range(start, end):
        if document[index] not in "\r\n":
            masked[index] = " "


def is_backslash_escaped(document: str, index: int) -> bool:
    backslashes = 0
    cursor = index - 1
    while cursor >= 0 and document[cursor] == "\\":
        backslashes += 1
        cursor -= 1
    return backslashes % 2 == 1


@dataclass
class InlineMaskState:
    """Inline parser state shared across every line in one document."""

    in_html_comment: bool = False
    inline_ticks: int = 0


def mask_html_comments_in_line(
    document: str,
    masked: list[str],
    start: int,
    end: int,
    state: InlineMaskState,
    mask_inline_code: bool,
    matching_backtick_openers: set[int],
) -> None:
    """Mask comments outside inline code while preserving cross-line state."""

    cursor = start
    while cursor < end:
        if state.in_html_comment:
            closing = document.find("-->", cursor, end)
            if closing == -1:
                mask_range(masked, document, cursor, end)
                return
            comment_end = closing + len("-->")
            mask_range(masked, document, cursor, comment_end)
            state.in_html_comment = False
            cursor = comment_end
            continue
        if document[cursor] == "`":
            tick_end = cursor + 1
            while tick_end < end and document[tick_end] == "`":
                tick_end += 1
            tick_length = tick_end - cursor
            if state.inline_ticks == 0 and is_backslash_escaped(document, cursor):
                cursor = tick_end
                continue
            if state.inline_ticks == 0:
                if cursor in matching_backtick_openers:
                    state.inline_ticks = tick_length
                    if mask_inline_code:
                        mask_range(masked, document, cursor, tick_end)
            elif state.inline_ticks == tick_length:
                if mask_inline_code:
                    mask_range(masked, document, cursor, tick_end)
                state.inline_ticks = 0
            elif mask_inline_code:
                mask_range(masked, document, cursor, tick_end)
            cursor = tick_end
            continue
        if state.inline_ticks and mask_inline_code:
            mask_range(masked, document, cursor, cursor + 1)
            cursor += 1
            continue
        if (
            state.inline_ticks == 0
            and document.startswith("<!--", cursor, end)
            and not is_backslash_escaped(document, cursor)
        ):
            state.in_html_comment = True
            continue
        cursor += 1


def matching_backtick_openers(document: str) -> set[int]:
    """Find runs with a later peer in the same inline block in linear time."""

    result: set[int] = set()
    runs_by_length: dict[int, list[tuple[int, bool]]] = {}
    pending_lengths: set[int] = set()
    active_list_indent = 0
    active_quote_depth = 0
    previous_container: tuple[int, int] | None = None

    def finish_block() -> None:
        for runs in runs_by_length.values():
            result.update(position for position, escaped in runs[:-1] if not escaped)
        runs_by_length.clear()
        pending_lengths.clear()

    offset = 0
    for line in document.splitlines(keepends=True):
        content = line.rstrip("\r\n")
        layout = content.expandtabs(4)
        quote_depth, quote_content = split_blockquote_prefix(layout)
        if quote_depth != active_quote_depth:
            active_list_indent = 0
            active_quote_depth = quote_depth
        list_indent, list_content = split_list_prefix(quote_content)
        raw_indent = leading_space_width(quote_content)
        starts_list_item = list_indent > 0
        marker_match = LIST_MARKER_PATTERN.match(quote_content)
        if (
            starts_list_item
            and marker_match is not None
            and marker_match.group("marker")[0].isdigit()
            and int(marker_match.group("marker")[:-1]) != 1
            and previous_container is not None
        ):
            list_indent = 0
            list_content = quote_content
            starts_list_item = False
        if starts_list_item and pending_lengths and not list_content.strip():
            list_indent = 0
            list_content = quote_content
            starts_list_item = False
        if starts_list_item:
            active_list_indent = list_indent
            container_content = list_content
        elif active_list_indent and raw_indent >= active_list_indent:
            container_content = quote_content[active_list_indent:]
        else:
            if quote_content.strip():
                active_list_indent = 0
            container_content = quote_content
        container = (quote_depth, active_list_indent)
        leaf_content = strip_explicit_container_markers(container_content)
        boundary = bool(
            not content.strip()
            or INLINE_BLOCK_BOUNDARY_PATTERN.match(leaf_content)
            or (
                not pending_lengths
                and INDENTED_CODE_BOUNDARY_PATTERN.match(leaf_content)
            )
        )
        container_changed = (
            previous_container is not None and container != previous_container
        )
        lazy_continuation = (
            bool(pending_lengths)
            and previous_container is not None
            and previous_container != (0, 0)
            and container == (0, 0)
            and not boundary
            and not starts_list_item
        )
        if (
            boundary
            or starts_list_item
            or (container_changed and not lazy_continuation)
        ):
            finish_block()
        for match in re.finditer(r"`+", content):
            position = offset + match.start()
            length = len(match.group(0))
            escaped = is_backslash_escaped(document, position)
            runs_by_length.setdefault(len(match.group(0)), []).append(
                (position, escaped)
            )
            if length in pending_lengths:
                pending_lengths.remove(length)
            elif not escaped:
                pending_lengths.add(length)
        if boundary:
            finish_block()
            previous_container = None
        else:
            previous_container = (
                previous_container if lazy_continuation else container
            )
        offset += len(line)
    finish_block()
    return result


def mask_markdown(
    document: str,
    *,
    mask_code_blocks: bool,
    mask_indented_code: bool,
    mask_inline_code: bool,
) -> str:
    """Mask non-rendered Markdown while preserving source offsets and newlines."""

    masked = list(document)
    fence_character: str | None = None
    fence_length = 0
    fence_quote_depth = 0
    fence_list_indent = 0
    fence_has_nested_containers = False
    inline_state = InlineMaskState()
    backtick_openers = matching_backtick_openers(document)
    active_list_indent = 0
    active_list_quote_depth = 0
    offset = 0

    for line in document.splitlines(keepends=True):
        content = line.rstrip("\r\n")
        content_end = offset + len(content)
        quote_depth, quote_content = split_blockquote_prefix(content.expandtabs(4))

        if quote_depth != active_list_quote_depth:
            active_list_indent = 0
            active_list_quote_depth = quote_depth

        if fence_character is not None and quote_depth < fence_quote_depth:
            fence_character = None
            fence_length = 0
            fence_list_indent = 0
            fence_has_nested_containers = False

        if fence_character is not None:
            if quote_depth > fence_quote_depth:
                if mask_code_blocks:
                    mask_range(masked, document, offset, content_end)
                offset += len(line)
                continue
            candidate = quote_content
            if fence_list_indent:
                if candidate.strip() and leading_space_width(candidate) < fence_list_indent:
                    fence_character = None
                    fence_length = 0
                    fence_list_indent = 0
                    fence_has_nested_containers = False
                else:
                    candidate = candidate[fence_list_indent:]
            if fence_character is not None:
                if fence_has_nested_containers:
                    candidate = strip_explicit_container_markers(candidate)
                if mask_code_blocks:
                    mask_range(masked, document, offset, content_end)
                closing = re.fullmatch(
                    rf" {{0,3}}{re.escape(fence_character)}{{{fence_length},}}[ \t]*",
                    candidate,
                )
                if closing is not None:
                    fence_character = None
                    fence_length = 0
                    fence_list_indent = 0
                    fence_has_nested_containers = False
                offset += len(line)
                continue

        quote_layout = quote_content
        list_indent, list_content = split_list_prefix(quote_layout)
        raw_indent = leading_space_width(quote_layout)
        if list_indent:
            active_list_indent = list_indent
            active_list_quote_depth = quote_depth
            container_content = list_content
            opening_list_indent = list_indent
        else:
            if quote_content.strip() and (
                active_list_indent == 0 or raw_indent < active_list_indent
            ):
                active_list_indent = 0
            if active_list_indent and raw_indent >= active_list_indent:
                container_content = quote_layout[active_list_indent:]
                opening_list_indent = active_list_indent
            else:
                container_content = quote_layout
                opening_list_indent = 0

        raw_container_content = container_content
        container_content = strip_explicit_container_markers(container_content)
        opening_fence = FENCED_CODE_PATTERN.fullmatch(container_content)
        if opening_fence is not None:
            fence = opening_fence.group("fence")
            info = opening_fence.group("info")
            if fence[0] != "`" or "`" not in info:
                fence_character = fence[0]
                fence_length = len(fence)
                fence_quote_depth = quote_depth
                fence_list_indent = opening_list_indent
                fence_has_nested_containers = (
                    container_content != raw_container_content
                )
                if mask_code_blocks:
                    mask_range(masked, document, offset, content_end)
                offset += len(line)
                continue

        is_indented_code = container_content.startswith(("\t", "    "))
        if is_indented_code:
            if mask_indented_code:
                mask_range(masked, document, offset, content_end)
            offset += len(line)
            continue

        mask_html_comments_in_line(
            document,
            masked,
            offset,
            content_end,
            inline_state,
            mask_inline_code,
            backtick_openers,
        )
        offset += len(line)

    return "".join(masked)


def mask_html_comments(document: str) -> str:
    """Mask HTML comments, but never comment-like text inside code."""

    return mask_markdown(
        document,
        mask_code_blocks=False,
        mask_indented_code=False,
        mask_inline_code=False,
    )


def mask_block_markdown(document: str) -> str:
    """Mask block code and comments while leaving visible inline code intact."""

    return mask_markdown(
        document,
        mask_code_blocks=True,
        mask_indented_code=False,
        mask_inline_code=False,
    )


REFERENCE_DEFINITION_PATTERN = re.compile(
    r"^ {0,3}\[(?P<label>(?:\\.|[^\[\]\r\n])+)]:(?P<tail>.*)$"
)


def reference_definition_leaf(content: str) -> str:
    """Return a block-container-free line for reference definition parsing."""

    return strip_explicit_container_markers(content.expandtabs(4))


def paragraph_container_after_line(
    leaf: str,
    container_signature: str,
    paragraph_container: str | None,
) -> str | None:
    """Track whether the next line may start a reference definition."""

    if paragraph_container != container_signature:
        paragraph_container = None
    stripped = leaf.strip()
    if not stripped:
        return None
    if re.match(r"^ {0,3}#{1,6}(?:[ \t]+|$)", leaf):
        return None
    if re.match(r"^ {0,3}(?:=+|-+)[ \t]*$", leaf):
        return None
    if re.match(r"^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$", leaf):
        return None
    return container_signature


def split_link_destination(value: str) -> str | None:
    """Return text after one valid destination, or None when invalid."""

    value = value.lstrip(" \t")
    if not value:
        return None
    if value.startswith("<"):
        backslashes = 0
        for index, character in enumerate(value[1:], start=1):
            escaped = backslashes % 2 == 1
            if character == "\\":
                backslashes += 1
                continue
            backslashes = 0
            if character in "\r\n" or (character == "<" and not escaped):
                return None
            if character == ">" and not escaped:
                return value[index + 1:]
        return None

    depth = 0
    backslashes = 0
    for index, character in enumerate(value):
        escaped = backslashes % 2 == 1
        if character == "\\":
            backslashes += 1
            continue
        backslashes = 0
        if character.isspace() and not escaped:
            return value[index:]
        if character == "(" and not escaped:
            depth += 1
            if depth > 32:
                return None
        elif character == ")" and not escaped:
            if depth == 0:
                return None
            depth -= 1
    return "" if depth == 0 else None


def consume_link_title(
    first: str,
    continuation_lines: list[str],
    container_signatures: list[str],
    start_index: int,
) -> tuple[int | None, int]:
    """Return the final continuation index for one valid link title."""

    value = first.lstrip(" \t")
    if not value or value[0] not in "\"'(":
        return None, start_index
    closer = ")" if value[0] == "(" else value[0]
    line_index = start_index
    container_signature = container_signatures[start_index]
    fragment = value[1:]
    while True:
        backslashes = 0
        for index, character in enumerate(fragment):
            escaped = backslashes % 2 == 1
            if character == "\\":
                backslashes += 1
                continue
            backslashes = 0
            if character == closer and not escaped:
                return (
                    (line_index, line_index)
                    if not fragment[index + 1:].strip()
                    else (None, line_index)
                )
        line_index += 1
        if line_index >= len(continuation_lines):
            return None, line_index - 1
        if container_signatures[line_index] != container_signature:
            return None, line_index
        fragment = continuation_lines[line_index]
        if not fragment.strip():
            return None, line_index


def parse_reference_definition(
    leaves: list[str],
    container_signatures: list[str],
    start_index: int,
) -> tuple[int, str | None] | None:
    """Parse one complete reference definition without masking invalid text."""

    match = REFERENCE_DEFINITION_PATTERN.fullmatch(leaves[start_index])
    if match is None:
        return None
    raw_label = match.group("label")
    label = " ".join(raw_label.split()).casefold()
    if not label or len(raw_label) > 999:
        return start_index, None
    line_index = start_index
    destination_and_title = match.group("tail")
    if not destination_and_title.strip():
        line_index += 1
        if line_index >= len(leaves):
            return start_index, None
        if container_signatures[line_index] != container_signatures[start_index]:
            return start_index, None
        destination_and_title = leaves[line_index]
    remainder = split_link_destination(destination_and_title)
    if remainder is None:
        return line_index, None
    if remainder.strip():
        if remainder[0] not in " \t\r\n":
            return line_index, None
        title_end, scanned_end = consume_link_title(
            remainder,
            leaves,
            container_signatures,
            line_index,
        )
        return (
            (title_end, label)
            if title_end is not None
            else (scanned_end, None)
        )
    next_index = line_index + 1
    if (
        next_index < len(leaves)
        and container_signatures[next_index] == container_signatures[start_index]
        and leaves[next_index].lstrip(" \t").startswith(("\"", "'", "("))
    ):
        title_end, scanned_end = consume_link_title(
            leaves[next_index],
            leaves,
            container_signatures,
            next_index,
        )
        return (
            (title_end, label)
            if title_end is not None
            else (scanned_end, None)
        )
    return line_index, label


def parse_inline_link_end(document: str, opening: int) -> tuple[int | None, int]:
    """Return a valid inline-link closing offset and a linear failure cursor."""

    cursor = opening + 1
    whitespace_start = cursor
    while cursor < len(document) and document[cursor] in " \t\r\n":
        cursor += 1
    if re.search(r"\n[ \t\r]*\n", document[whitespace_start:cursor]):
        return None, cursor
    if cursor < len(document) and document[cursor] == ")":
        return cursor, cursor + 1

    destination_start = cursor
    if cursor < len(document) and document[cursor] == "<":
        cursor += 1
        backslashes = 0
        while cursor < len(document):
            character = document[cursor]
            escaped = backslashes % 2 == 1
            if character == "\\":
                backslashes += 1
                cursor += 1
                continue
            backslashes = 0
            if character in "\r\n" or (character == "<" and not escaped):
                return None, cursor + 1
            cursor += 1
            if character == ">" and not escaped:
                break
        else:
            return None, cursor
    else:
        depth = 0
        backslashes = 0
        while cursor < len(document):
            character = document[cursor]
            escaped = backslashes % 2 == 1
            if character == "\\":
                backslashes += 1
                cursor += 1
                continue
            backslashes = 0
            if character.isspace() and not escaped:
                break
            if character == "(" and not escaped:
                depth += 1
                if depth > 32:
                    return None, cursor + 1
            elif character == ")" and not escaped:
                if depth == 0:
                    return (
                        (cursor, cursor + 1)
                        if cursor > destination_start
                        else (None, cursor + 1)
                    )
                depth -= 1
            cursor += 1
        if cursor == destination_start or depth:
            return None, max(cursor, opening + 1)

    whitespace_start = cursor
    while cursor < len(document) and document[cursor] in " \t\r\n":
        cursor += 1
    if re.search(r"\n[ \t\r]*\n", document[whitespace_start:cursor]):
        return None, cursor
    if cursor < len(document) and document[cursor] in "\"'(":
        if cursor == whitespace_start:
            return None, cursor + 1
        closer = ")" if document[cursor] == "(" else document[cursor]
        cursor += 1
        backslashes = 0
        while cursor < len(document):
            character = document[cursor]
            escaped = backslashes % 2 == 1
            if character == "\\":
                backslashes += 1
                cursor += 1
                continue
            backslashes = 0
            cursor += 1
            if character == closer and not escaped:
                break
        else:
            return None, cursor
        whitespace_start = cursor
        while cursor < len(document) and document[cursor] in " \t\r\n":
            cursor += 1
        if re.search(r"\n[ \t\r]*\n", document[whitespace_start:cursor]):
            return None, cursor
    return (
        (cursor, cursor + 1)
        if cursor < len(document) and document[cursor] == ")"
        else (None, max(cursor, opening + 1))
    )


def mask_link_metadata(document: str) -> str:
    """Mask non-visible link destinations, titles, and reference labels."""

    masked = list(document)
    lines = document.splitlines(keepends=True)
    contents = [line.rstrip("\r\n") for line in lines]
    container_lines = markdown_container_lines(contents)
    leaves = [leaf for leaf, _ in container_lines]
    container_signatures = [signature or "" for _, signature in container_lines]
    offsets: list[int] = []
    offset = 0
    for line in lines:
        offsets.append(offset)
        offset += len(line)
    valid_reference_labels: set[str] = set()
    line_index = 0
    paragraph_container: str | None = None
    while line_index < len(lines):
        container_signature = container_signatures[line_index]
        if paragraph_container != container_signature:
            paragraph_container = None
        parsed = parse_reference_definition(
            leaves,
            container_signatures,
            line_index,
        )
        if parsed is None or paragraph_container is not None:
            paragraph_container = paragraph_container_after_line(
                leaves[line_index],
                container_signature,
                paragraph_container,
            )
            line_index += 1
            continue
        end_index, label = parsed
        if label is None:
            for state_index in range(line_index, end_index + 1):
                paragraph_container = paragraph_container_after_line(
                    leaves[state_index],
                    container_signatures[state_index],
                    paragraph_container,
                )
            line_index = max(line_index + 1, end_index + 1)
            continue
        valid_reference_labels.add(label)
        for masked_index in range(line_index, end_index + 1):
            mask_range(
                masked,
                document,
                offsets[masked_index],
                offsets[masked_index] + len(contents[masked_index]),
            )
        line_index = end_index + 1

    visible = "".join(masked)
    bracket_openers: list[tuple[int, bool, int]] = []
    link_generation = 0
    cursor = 0
    while cursor < len(visible):
        character = visible[cursor]
        if character == "[" and not is_backslash_escaped(visible, cursor):
            image_opener = (
                cursor > 0
                and visible[cursor - 1] == "!"
                and not is_backslash_escaped(visible, cursor - 1)
            )
            bracket_openers.append((cursor, image_opener, link_generation))
            cursor += 1
            continue
        if character != "]" or is_backslash_escaped(visible, cursor):
            cursor += 1
            continue

        while (
            bracket_openers
            and not bracket_openers[-1][1]
            and bracket_openers[-1][2] != link_generation
        ):
            bracket_openers.pop()
        if not bracket_openers:
            cursor += 1
            continue

        opener, image_opener, _ = bracket_openers.pop()
        metadata_start = cursor + 1
        if metadata_start >= len(visible):
            cursor += 1
            continue
        if visible[metadata_start] == "(":
            metadata_end, failure_cursor = parse_inline_link_end(
                visible,
                metadata_start,
            )
            if metadata_end is not None:
                mask_range(
                    masked,
                    document,
                    metadata_start,
                    metadata_end + 1,
                )
                if image_opener:
                    mask_range(masked, document, opener - 1, cursor + 1)
                else:
                    link_generation += 1
                cursor = metadata_end + 1
                continue
            cursor = failure_cursor
            continue
        elif visible[metadata_start] == "[":
            metadata_end = metadata_start + 1
            backslashes = 0
            while metadata_end < len(visible):
                candidate = visible[metadata_end]
                if candidate in "\r\n":
                    break
                escaped = backslashes % 2 == 1
                if candidate == "\\":
                    backslashes += 1
                    metadata_end += 1
                    continue
                backslashes = 0
                if (
                    candidate == "]"
                    and not escaped
                ):
                    raw_reference_label = visible[
                        metadata_start + 1:metadata_end
                    ]
                    reference_label = (
                        " ".join(raw_reference_label.split()).casefold()
                        if len(raw_reference_label) <= 999
                        else ""
                    )
                    if not reference_label:
                        reference_label = (
                            " ".join(visible[opener + 1:cursor].split()).casefold()
                            if cursor - opener - 1 <= 999
                            else ""
                        )
                    if reference_label in valid_reference_labels:
                        mask_range(
                            masked,
                            document,
                            metadata_start,
                            metadata_end + 1,
                        )
                        if image_opener:
                            mask_range(masked, document, opener - 1, cursor + 1)
                        else:
                            link_generation += 1
                        cursor = metadata_end + 1
                    break
                metadata_end += 1
            if cursor == metadata_end + 1:
                continue
            cursor = max(metadata_end, metadata_start + 1)
            continue
        shortcut_label = (
            " ".join(visible[opener + 1:cursor].split()).casefold()
            if cursor - opener - 1 <= 999
            else ""
        )
        if shortcut_label in valid_reference_labels:
            if image_opener:
                mask_range(masked, document, opener - 1, cursor + 1)
            else:
                link_generation += 1
        cursor += 1

    return "".join(masked)


def mask_non_rendered_markdown(document: str) -> str:
    """Mask code blocks and HTML comments while preserving source offsets."""

    return mask_link_metadata(
        mask_markdown(
            document,
            mask_code_blocks=True,
            mask_indented_code=True,
            mask_inline_code=True,
        )
    )


def extract_visible_requirement_mentions(value: str) -> list[str]:
    return extract_requirement_mentions(mask_non_rendered_markdown(value))


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


def requirement_section_ids_for_heading(heading: str) -> tuple[str, ...]:
    normalized_heading = normalize_structured_text(heading)
    segments = [
        segment.strip()
        for segment in re.split(r"[/／|｜・]", normalized_heading)
    ]
    return tuple(
        section_id
        for section_id, aliases in REQUIRED_REQUIREMENTS_SECTIONS.items()
        if any(
            segment.startswith(normalize_structured_text(alias))
            for segment in segments
            for alias in aliases
        )
    )

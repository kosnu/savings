#!/usr/bin/env python3
"""Reject changes to immutable sections of accepted ADRs."""

from __future__ import annotations

import argparse
import ast
import datetime
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

sys.dont_write_bytecode = True

MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
PROTECTED_HEADINGS = ("Context", "Decision", "Consequences")
CLARIFICATION_HEADING = re.compile(
    r"^Clarification: .+ \((\d{4}-\d{2}-\d{2})\)$"
)
FRONT_MATTER_FIELD = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$")
ATX_H2 = re.compile(r"^[ ]{0,3}##(?:[ \t]+|$)(.*)$")
FENCE_OPEN = re.compile(r"^[ ]{0,3}(`{3,}|~{3,})(.*)$")
ADR_BYTES = re.compile(rb"(?m)^[ \t]*doc_type[ \t]*:[ \t]*['\"]?adr(?:['\"# \t\r\n]|$)")


class ValidationError(ValueError):
    pass


def run_git(repo_root: Path, arguments: list[str]) -> bytes:
    completed = subprocess.run(
        ["git", "-C", os.fspath(repo_root), *arguments],
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise ValidationError(detail or f"git {' '.join(arguments)} failed")
    return completed.stdout


def require_repository_root(repo_root: Path) -> Path:
    absolute = Path(os.path.abspath(repo_root))
    if absolute != absolute.resolve():
        raise ValidationError("repo-root must not contain symlinks")
    actual = Path(
        run_git(absolute, ["rev-parse", "--show-toplevel"])
        .decode("utf-8")
        .strip()
    ).resolve()
    if actual != absolute:
        raise ValidationError("repo-root must be the Git worktree root")
    return absolute


def strip_yaml_comment(value: str) -> str:
    quote: str | None = None
    escaped = False
    for index, character in enumerate(value):
        if escaped:
            escaped = False
            continue
        if quote == '"' and character == "\\":
            escaped = True
            continue
        if character in {"'", '"'}:
            if quote is None:
                quote = character
            elif quote == character:
                quote = None
            continue
        if character == "#" and quote is None and (
            index == 0 or value[index - 1].isspace()
        ):
            return value[:index].rstrip()
    return value.rstrip()


def parse_front_matter_scalar(value: str, key: str, label: str) -> str:
    canonical = strip_yaml_comment(value).strip()
    if not canonical or canonical[0] in "|>&*!{[":
        raise ValidationError(f"{label} has unsupported {key} front matter")
    if canonical[0] in {"'", '"'}:
        try:
            parsed = ast.literal_eval(canonical)
        except (SyntaxError, ValueError) as error:
            raise ValidationError(f"{label} has invalid {key} front matter") from error
        if not isinstance(parsed, str):
            raise ValidationError(f"{label} has non-string {key} front matter")
        return parsed
    return canonical


def front_matter_values(text: str, label: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        return {}
    try:
        closing = lines.index("---", 1)
    except ValueError:
        raise ValidationError(f"{label} front matter is not closed") from None
    values: dict[str, str] = {}
    for line in lines[1:closing]:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = FRONT_MATTER_FIELD.fullmatch(line)
        if match is None:
            if re.match(r"^[ \t]*(doc_type|status)\b", line):
                raise ValidationError(f"{label} has invalid ADR front matter")
            continue
        key, raw_value = match.groups()
        if key not in {"doc_type", "status"}:
            continue
        if key in values:
            raise ValidationError(f"{label} has duplicate {key} front matter")
        values[key] = parse_front_matter_scalar(raw_value, key, label)
    return values


def markdown_h2_indexes(lines: list[str]) -> list[tuple[int, str]]:
    headings: list[tuple[int, str]] = []
    fence: tuple[str, int] | None = None
    for index, line in enumerate(lines):
        content = line.rstrip("\r\n")
        if fence is not None:
            character, length = fence
            if re.fullmatch(
                rf"[ ]{{0,3}}{re.escape(character)}{{{length},}}[ \t]*", content
            ):
                fence = None
            continue
        opening = FENCE_OPEN.fullmatch(content)
        if opening is not None:
            marker, info = opening.groups()
            if marker[0] != "`" or "`" not in info:
                fence = (marker[0], len(marker))
                continue
        heading = ATX_H2.fullmatch(content)
        if heading is not None:
            name = re.sub(r"[ \t]+#+[ \t]*$", "", heading.group(1)).strip()
            headings.append((index, name))
    return headings


def protected_history(text: str, label: str) -> str:
    lines = text.splitlines(keepends=True)
    headings = markdown_h2_indexes(lines)
    indexes: dict[str, int] = {}
    for name in PROTECTED_HEADINGS:
        matches = [index for index, heading in headings if heading == name]
        if len(matches) != 1:
            raise ValidationError(f"{label} must contain exactly one ## {name} section")
        indexes[name] = matches[0]
    if [indexes[name] for name in PROTECTED_HEADINGS] != sorted(indexes.values()):
        raise ValidationError(f"{label} protected ADR sections are out of order")
    start = indexes["Context"]
    return "".join(lines[start:])


def validate_history_extension(baseline_text: str, current_text: str, label: str) -> None:
    baseline = protected_history(baseline_text, f"baseline {label}")
    current = protected_history(current_text, label)
    if current == baseline:
        return
    if not current.startswith(baseline):
        raise ValidationError(
            "accepted ADR history changed; restore existing Context, Decision, "
            f"Consequences, and Clarifications: {label}"
        )
    appended = current.removeprefix(baseline)
    if not appended or appended[0] not in "\r\n":
        raise ValidationError(
            f"accepted ADR Clarification must be appended on a new line: {label}"
        )
    lines = appended.lstrip("\r\n").splitlines(keepends=True)
    headings = markdown_h2_indexes(lines)
    if not headings or headings[0][0] != 0:
        raise ValidationError(
            f"accepted ADR additions must start with a dated Clarification: {label}"
        )
    for position, (index, heading) in enumerate(headings):
        match = CLARIFICATION_HEADING.fullmatch(heading)
        if match is None:
            raise ValidationError(
                f"accepted ADR additions must be dated Clarifications: {label}"
            )
        try:
            datetime.date.fromisoformat(match.group(1))
        except ValueError as error:
            raise ValidationError(
                f"accepted ADR Clarification date is invalid: {label}"
            ) from error
        end = headings[position + 1][0] if position + 1 < len(headings) else len(lines)
        if not any(line.strip() for line in lines[index + 1 : end]):
            raise ValidationError(
                f"accepted ADR Clarification must have content: {label}"
            )


def baseline_markdown_paths(repo_root: Path, base_commit: str) -> list[str]:
    listing = run_git(
        repo_root,
        ["ls-tree", "-r", "--name-only", "-z", base_commit, "--", "docs", "apps"],
    )
    paths = []
    for raw_path in listing.split(b"\0"):
        if not raw_path:
            continue
        path = raw_path.decode("utf-8", errors="surrogateescape")
        if path.endswith(".md"):
            paths.append(path)
    return sorted(paths)


def read_baseline(repo_root: Path, base_commit: str, path: str) -> bytes:
    return run_git(repo_root, ["show", f"{base_commit}:{path}"])


def read_worktree(repo_root: Path, path: str) -> bytes:
    absolute = repo_root / path
    current = repo_root
    for part in PurePosixPath(path).parts:
        current /= part
        if current.is_symlink():
            raise ValidationError(f"accepted ADR path must not contain symlinks: {path}")
    if not absolute.is_file():
        raise ValidationError(f"accepted ADR must not be removed or moved: {path}")
    data = absolute.read_bytes()
    if len(data) > MAX_DOCUMENT_BYTES:
        raise ValidationError(f"accepted ADR exceeds size limit: {path}")
    return data


def validate(repo_root: Path, base_ref: str) -> tuple[str, list[str]]:
    canonical_root = require_repository_root(repo_root)
    symbolic_base = run_git(
        canonical_root, ["rev-parse", "--symbolic-full-name", base_ref]
    ).decode("utf-8").strip()
    if not symbolic_base.startswith("refs/remotes/origin/"):
        raise ValidationError("base-ref must be an origin remote-tracking branch")
    if run_git(canonical_root, ["rev-parse", "--is-shallow-repository"]).strip() == b"true":
        raise ValidationError("accepted ADR validation requires complete Git history")
    merge_bases = run_git(
        canonical_root, ["merge-base", "--all", "HEAD", symbolic_base]
    ).decode("ascii").splitlines()
    if len(merge_bases) != 1:
        raise ValidationError("accepted ADR validation requires one merge-base")
    base_commit = merge_bases[0]
    checked: list[str] = []
    for path in baseline_markdown_paths(canonical_root, base_commit):
        baseline_data = read_baseline(canonical_root, base_commit, path)
        path_is_adr = "adr" in PurePosixPath(path).parts
        looks_like_adr = ADR_BYTES.search(baseline_data) is not None
        if len(baseline_data) > MAX_DOCUMENT_BYTES:
            if path_is_adr or looks_like_adr:
                raise ValidationError(f"accepted ADR exceeds size limit: {path}")
            continue
        try:
            baseline_text = baseline_data.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            if path_is_adr or looks_like_adr:
                raise ValidationError(f"baseline ADR must be UTF-8: {path}") from error
            continue
        metadata = front_matter_values(baseline_text, f"{base_commit}:{path}")
        if metadata.get("doc_type") != "adr":
            if path_is_adr:
                raise ValidationError(f"ADR path must declare doc_type: adr: {path}")
            continue
        if metadata.get("status") != "accepted":
            continue
        try:
            current_text = read_worktree(canonical_root, path).decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValidationError(f"accepted ADR must be UTF-8: {path}") from error
        validate_history_extension(baseline_text, current_text, path)
        checked.append(path)
    return base_commit, checked


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--base-ref", required=True)
    args = parser.parse_args()
    try:
        base_commit, checked = validate(args.repo_root, args.base_ref)
    except (OSError, ValidationError) as error:
        print(f"accepted ADR validation: failed: {error}", file=sys.stderr)
        return 1
    print(
        "accepted ADR validation: passed: "
        f"base={base_commit} checked={len(checked)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Resolve canonical AIDD artifact baselines from the repository HEAD."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import unicodedata
from pathlib import Path

from artifact_source import (
    ARTIFACT_KINDS,
    DISPLAY_FILENAMES,
    SOURCE_FILENAMES,
    SUPPORTED_SCHEMA_VERSIONS,
    SourceError,
    canonical_display_path as source_canonical_display_path,
    canonical_source_path as source_canonical_source_path,
    validate_workspace_name as validate_source_workspace_name,
)


ISSUE_PATTERN = re.compile(
    r"(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+)#(?P<number>[1-9][0-9]*)"
)
ASCII_TITLE_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
WORKSPACE_TITLE_MAX_LENGTH = 48
WORKSPACE_TITLE_DIGEST_LENGTH = 12
MAX_GIT_BLOB_BYTES = 16 * 1024 * 1024
CANONICAL_ARTIFACT_FILENAMES = {
    filename: kind
    for kind, filename in DISPLAY_FILENAMES.items()
    if kind in ARTIFACT_KINDS
}


class GitBaselineError(ValueError):
    pass


def validate_workspace_name(workspace: str) -> None:
    try:
        validate_source_workspace_name(workspace)
    except SourceError as error:
        raise GitBaselineError(str(error)) from error


def canonical_artifact_path(
    repo_root: Path,
    workspace: str,
    filename: str,
) -> Path:
    kind = CANONICAL_ARTIFACT_FILENAMES.get(filename)
    if kind is None:
        raise GitBaselineError(f"unsupported canonical artifact: {filename}")
    try:
        return source_canonical_display_path(repo_root, workspace, kind)
    except SourceError as error:
        raise GitBaselineError(str(error)) from error


def canonical_source_path(
    repo_root: Path,
    workspace: str,
    kind: str,
) -> Path:
    try:
        return source_canonical_source_path(repo_root, workspace, kind)
    except SourceError as error:
        raise GitBaselineError(str(error)) from error


def require_canonical_worktree_path(
    repo_root: Path,
    supplied_path: Path,
    relative_path: Path,
    label: str,
) -> Path:
    """Require an exact, non-symlink path below the canonical worktree root."""

    absolute_root = Path(os.path.abspath(repo_root))
    require_repository_root(absolute_root)
    canonical_path = absolute_root / relative_path
    absolute_supplied_path = Path(os.path.abspath(supplied_path))
    if absolute_supplied_path != canonical_path:
        raise GitBaselineError(f"{label} must use the canonical repository path")

    current_path = absolute_root
    for part in relative_path.parts:
        current_path /= part
        if current_path.is_symlink():
            raise GitBaselineError(f"{label} canonical path must not contain symlinks")
    return canonical_path


def run_git(repo_root: Path, arguments: list[str]) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        capture_output=True,
        check=False,
    )


def require_repository_root(repo_root: Path) -> Path:
    absolute_root = Path(os.path.abspath(repo_root))
    resolved_root = absolute_root.resolve()
    if absolute_root != resolved_root:
        raise GitBaselineError("repo-root must not contain symlinks")
    result = run_git(resolved_root, ["rev-parse", "--show-toplevel"])
    if result.returncode != 0:
        raise GitBaselineError("repo-root is not a readable Git worktree")
    actual_root = Path(result.stdout.decode("utf-8").strip()).resolve()
    if actual_root != resolved_root:
        raise GitBaselineError("repo-root must be the Git worktree root")
    if run_git(resolved_root, ["rev-parse", "--verify", "HEAD"]).returncode != 0:
        raise GitBaselineError("Git HEAD is unavailable")
    return resolved_root


def issue_number(issue: str) -> str:
    match = ISSUE_PATTERN.fullmatch(issue)
    if match is None:
        raise GitBaselineError("issue must use owner/repo#number")
    return match.group("number")


def canonical_workspace_name(issue: str, issue_title: str) -> str:
    """Derive the only allowed first workspace name from Issue identity."""

    number = issue_number(issue)
    normalized_title = " ".join(
        unicodedata.normalize("NFKC", issue_title).casefold().split()
    )
    if not normalized_title:
        raise GitBaselineError("issue title must be non-empty")
    title_digest = hashlib.sha256(normalized_title.encode("utf-8")).hexdigest()[
        :WORKSPACE_TITLE_DIGEST_LENGTH
    ]
    readable = "-".join(ASCII_TITLE_TOKEN_PATTERN.findall(normalized_title))
    readable = readable[:WORKSPACE_TITLE_MAX_LENGTH].strip("-") or "issue"
    return f"{number}-{readable}-{title_digest}"


def list_issue_workspaces(repo_root: Path, number: str) -> list[str]:
    resolved_root = require_repository_root(repo_root)
    workspace_root = (
        resolved_root / "docs" / "ai-driven-development" / "workspaces"
    )
    names: set[str] = set()

    listing = run_git(
        resolved_root,
        [
            "ls-tree",
            "-r",
            "--name-only",
            "HEAD",
            "--",
            "docs/ai-driven-development/workspaces",
        ],
    )
    if listing.returncode != 0:
        raise GitBaselineError("failed to inspect AIDD workspaces in Git HEAD")
    prefix = "docs/ai-driven-development/workspaces/"
    for path in listing.stdout.decode("utf-8").splitlines():
        if path.startswith(prefix):
            names.add(path.removeprefix(prefix).split("/", 1)[0])

    if workspace_root.is_dir():
        names.update(path.name for path in workspace_root.iterdir() if path.is_dir())

    issue_prefix = f"{number}-"
    return sorted(name for name in names if name.startswith(issue_prefix))


def git_head_workspace_names(repo_root: Path, number: str) -> set[str]:
    resolved_root = require_repository_root(repo_root)
    listing = run_git(
        resolved_root,
        [
            "ls-tree",
            "-r",
            "--name-only",
            "HEAD",
            "--",
            "docs/ai-driven-development/workspaces",
        ],
    )
    if listing.returncode != 0:
        raise GitBaselineError("failed to inspect AIDD workspaces in Git HEAD")
    prefix = "docs/ai-driven-development/workspaces/"
    issue_prefix = f"{number}-"
    return {
        path.removeprefix(prefix).split("/", 1)[0]
        for path in listing.stdout.decode("utf-8").splitlines()
        if path.startswith(prefix)
        and path.removeprefix(prefix).split("/", 1)[0].startswith(issue_prefix)
    }


def validate_workspace_identity(
    repo_root: Path,
    issue: str,
    workspace: str,
    issue_title: str | None = None,
) -> list[str]:
    validate_workspace_name(workspace)
    number = issue_number(issue)
    if not workspace.startswith(f"{number}-"):
        raise GitBaselineError(
            f"workspace must begin with the Issue number: {number}-"
        )

    existing = list_issue_workspaces(repo_root, number)
    if len(existing) > 1:
        raise GitBaselineError(
            "multiple workspaces already exist for the Issue; consolidate them "
            f"before starting another cycle: {', '.join(existing)}"
        )
    if existing and existing[0] != workspace:
        raise GitBaselineError(
            "the Issue already has a canonical workspace; reuse "
            f"{existing[0]} instead of {workspace}"
        )
    established = workspace in git_head_workspace_names(repo_root, number)
    if not established:
        if issue_title is None:
            raise GitBaselineError(
                "issue title is required to establish the canonical workspace"
            )
        expected = canonical_workspace_name(issue, issue_title)
        if workspace != expected:
            raise GitBaselineError(
                "first workspace must equal the canonical Issue-derived name: "
                f"{expected}"
            )
    return existing


def load_git_head_artifact(
    repo_root: Path,
    workspace: str,
    filename: str,
) -> tuple[Path, bytes | None]:
    resolved_root = require_repository_root(repo_root)
    artifact_path = canonical_artifact_path(resolved_root, workspace, filename)
    relative_path = artifact_path.relative_to(resolved_root).as_posix()
    return artifact_path, load_regular_head_blob(
        resolved_root, relative_path, "canonical artifact"
    )


def load_regular_head_blob(
    repo_root: Path,
    relative_path: str,
    label: str,
) -> bytes | None:
    listing = run_git(
        repo_root,
        ["ls-tree", "-z", "HEAD", "--", relative_path],
    )
    if listing.returncode != 0:
        raise GitBaselineError(f"failed to inspect the {label} in Git HEAD")
    entries = [entry for entry in listing.stdout.split(b"\0") if entry]
    if not entries:
        return None
    if len(entries) != 1 or b"\t" not in entries[0]:
        raise GitBaselineError(f"{label} lookup returned an unexpected entry")
    metadata, encoded_path = entries[0].split(b"\t", 1)
    fields = metadata.decode("ascii").split()
    if encoded_path.decode("utf-8") != relative_path or len(fields) != 3:
        raise GitBaselineError(f"{label} lookup returned an unexpected path")
    mode, object_type, object_id = fields
    if mode not in {"100644", "100755"} or object_type != "blob":
        raise GitBaselineError(f"{label} in Git HEAD must be a regular file")
    size = run_git(repo_root, ["cat-file", "-s", object_id])
    if size.returncode != 0:
        raise GitBaselineError(f"failed to inspect the {label} size in Git HEAD")
    try:
        blob_size = int(size.stdout.decode("ascii").strip())
    except ValueError as error:
        raise GitBaselineError(f"{label} size in Git HEAD is invalid") from error
    if blob_size > MAX_GIT_BLOB_BYTES:
        raise GitBaselineError(
            f"{label} in Git HEAD exceeds {MAX_GIT_BLOB_BYTES} bytes"
        )
    content = run_git(repo_root, ["cat-file", "blob", object_id])
    if content.returncode != 0:
        raise GitBaselineError(f"failed to read the {label} from Git HEAD")
    return content.stdout


def load_git_head_source(
    repo_root: Path,
    workspace: str,
    kind: str,
) -> tuple[Path, bytes | None]:
    resolved_root = require_repository_root(repo_root)
    source_path = canonical_source_path(resolved_root, workspace, kind)
    relative_path = source_path.relative_to(resolved_root).as_posix()
    return source_path, load_regular_head_blob(
        resolved_root, relative_path, "canonical JSON source"
    )


def list_git_head_managed_artifact_keys(
    repo_root: Path,
) -> set[tuple[str, str]]:
    """List supported managed artifact paths without importing historical sidecars."""

    resolved_root = require_repository_root(repo_root)
    listing = run_git(
        resolved_root,
        [
            "ls-tree",
            "-r",
            "--name-only",
            "HEAD",
            "--",
            "docs/ai-driven-development/workspaces",
        ],
    )
    if listing.returncode != 0:
        raise GitBaselineError(
            "failed to inspect managed AIDD sources in Git HEAD"
        )

    source_kinds = {filename: kind for kind, filename in SOURCE_FILENAMES.items()}
    prefix = "docs/ai-driven-development/workspaces/"
    managed: set[tuple[str, str]] = set()
    for value in listing.stdout.decode("utf-8").splitlines():
        if not value.startswith(prefix):
            continue
        workspace, separator, filename = value.removeprefix(prefix).partition("/")
        if not separator or "/" in filename:
            continue
        kind = source_kinds.get(filename)
        if kind is None:
            continue
        relative_path = value
        content = load_regular_head_blob(
            resolved_root, relative_path, "managed AIDD source"
        )
        if content is None:
            continue
        try:
            source = json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if not isinstance(source, dict):
            continue
        if source.get("schema_version") not in SUPPORTED_SCHEMA_VERSIONS:
            continue
        validate_workspace_name(workspace)
        managed.add((workspace, kind))
    return managed

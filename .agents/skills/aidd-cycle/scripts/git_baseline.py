"""Resolve canonical AIDD artifact baselines from the repository HEAD."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path


WORKSPACE_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]*")
ISSUE_PATTERN = re.compile(
    r"(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+)#(?P<number>[1-9][0-9]*)"
)
VERSIONED_WORKSPACE_MARKER_PATTERN = re.compile(
    r"(?:^|-)(?:v[0-9]+|(?:ver|version|rev|revision|cycle)-?[0-9]+|"
    r"retry(?:-[0-9]+)?|rerun(?:-[0-9]+)?)(?:-|$)"
)
MAX_GIT_BLOB_BYTES = 16 * 1024 * 1024


class GitBaselineError(ValueError):
    pass


def validate_workspace_name(workspace: str) -> None:
    if WORKSPACE_PATTERN.fullmatch(workspace) is None:
        raise GitBaselineError("workspace must use lowercase ASCII kebab-case")
    if VERSIONED_WORKSPACE_MARKER_PATTERN.search(workspace) is not None:
        raise GitBaselineError(
            "workspace must not use a version, cycle, retry, or rerun marker"
        )


def canonical_artifact_path(
    repo_root: Path,
    workspace: str,
    filename: str,
) -> Path:
    validate_workspace_name(workspace)
    if filename not in {"requirements.md", "design-doc.md"}:
        raise GitBaselineError(f"unsupported canonical artifact: {filename}")
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / filename
    )


def canonical_source_path(
    repo_root: Path,
    workspace: str,
    kind: str,
) -> Path:
    validate_workspace_name(workspace)
    filenames = {
        "requirements": "requirements.json",
        "design": "design.json",
    }
    if kind not in filenames:
        raise GitBaselineError(f"unsupported canonical source kind: {kind}")
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / filenames[kind]
    )


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


def validate_workspace_identity(
    repo_root: Path,
    issue: str,
    workspace: str,
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

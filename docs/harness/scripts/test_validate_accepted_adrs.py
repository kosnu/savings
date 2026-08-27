from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True

import validate_accepted_adrs
from validate_accepted_adrs import ValidationError, validate


ACCEPTED_ADR = """---
title: Example ADR
doc_type: adr
status: accepted
---

# Example ADR

## Status

Accepted.

## Context

Original context.

## Decision

Original decision.

## Consequences

Original consequences.
"""

DRAFT_ADR = ACCEPTED_ADR.replace("status: accepted", "status: draft")


def run_git(repo_root: Path, *arguments: str) -> str:
    return subprocess.run(
        ["git", "-C", os.fspath(repo_root), *arguments],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def initialize_repo(repo_root: Path) -> str:
    run_git(repo_root, "init", "-q")
    run_git(repo_root, "branch", "-M", "main")
    run_git(repo_root, "config", "user.email", "test@example.com")
    run_git(repo_root, "config", "user.name", "Test User")
    accepted = repo_root / "docs" / "adr" / "0001-example.md"
    accepted.parent.mkdir(parents=True)
    accepted.write_text(ACCEPTED_ADR, encoding="utf-8")
    draft = repo_root / "apps" / "web" / "docs" / "adr" / "0002-draft.md"
    draft.parent.mkdir(parents=True)
    draft.write_text(DRAFT_ADR, encoding="utf-8")
    run_git(repo_root, "add", ".")
    run_git(repo_root, "commit", "-qm", "baseline")
    return set_origin_main(repo_root)


def set_origin_main(repo_root: Path) -> str:
    run_git(repo_root, "update-ref", "refs/remotes/origin/main", "HEAD")
    return "origin/main"


class AcceptedAdrValidationTest(unittest.TestCase):
    def test_allows_dated_clarification_and_draft_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            base = initialize_repo(repo_root)
            accepted = repo_root / "docs" / "adr" / "0001-example.md"
            accepted.write_text(
                ACCEPTED_ADR
                + "\n## Clarification: Follow-up (2026-08-26)\n\nNew guidance.\n",
                encoding="utf-8",
            )
            draft = repo_root / "apps" / "web" / "docs" / "adr" / "0002-draft.md"
            draft.write_text(
                DRAFT_ADR.replace("Original decision.", "Draft update."),
                encoding="utf-8",
            )

            resolved_base, checked = validate(repo_root, base)

            self.assertEqual(
                resolved_base, run_git(repo_root, "rev-parse", "origin/main")
            )
            self.assertEqual(checked, ["docs/adr/0001-example.md"])

    def test_rejects_changes_to_each_protected_section(self) -> None:
        for heading, original in (
            ("Context", "Original context."),
            ("Decision", "Original decision."),
            ("Consequences", "Original consequences."),
        ):
            with self.subTest(heading=heading), tempfile.TemporaryDirectory() as directory:
                repo_root = Path(directory).resolve()
                base = initialize_repo(repo_root)
                path = repo_root / "docs" / "adr" / "0001-example.md"
                path.write_text(
                    ACCEPTED_ADR.replace(original, f"Changed {heading}."),
                    encoding="utf-8",
                )

                with self.assertRaisesRegex(ValidationError, "history changed"):
                    validate(repo_root, base)

    def test_rejects_removing_an_accepted_adr(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            base = initialize_repo(repo_root)
            (repo_root / "docs" / "adr" / "0001-example.md").unlink()

            with self.assertRaisesRegex(ValidationError, "must not be removed"):
                validate(repo_root, base)

    def test_finds_accepted_adrs_outside_an_adr_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            policy_path = repo_root / "docs" / "decisions.md"
            policy_path.write_text(ACCEPTED_ADR, encoding="utf-8")
            run_git(repo_root, "add", ".")
            run_git(repo_root, "commit", "-qm", "add accepted ADR")
            base = set_origin_main(repo_root)
            policy_path.write_text(
                ACCEPTED_ADR.replace("Original decision.", "Changed decision."),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "history changed"):
                validate(repo_root, base)

    def test_rejects_editing_an_existing_clarification(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            path = repo_root / "docs" / "adr" / "0001-example.md"
            path.write_text(
                ACCEPTED_ADR
                + "\n## Clarification: Existing (2026-08-25)\n\nOriginal detail.\n",
                encoding="utf-8",
            )
            run_git(repo_root, "add", ".")
            run_git(repo_root, "commit", "-qm", "add clarification")
            base = set_origin_main(repo_root)
            path.write_text(
                path.read_text(encoding="utf-8").replace(
                    "Original detail.", "Rewritten detail."
                ),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "history changed"):
                validate(repo_root, base)

    def test_rejects_undated_or_empty_additions(self) -> None:
        additions = (
            "\n## Notes\n\nUndated guidance.\n",
            "\n## Clarification: Empty (2026-08-26)\n",
            "\n## Clarification: Bad date (2026-02-30)\n\nGuidance.\n",
        )
        for addition in additions:
            with self.subTest(addition=addition), tempfile.TemporaryDirectory() as directory:
                repo_root = Path(directory).resolve()
                base = initialize_repo(repo_root)
                path = repo_root / "docs" / "adr" / "0001-example.md"
                path.write_text(ACCEPTED_ADR + addition, encoding="utf-8")

                with self.assertRaises(ValidationError):
                    validate(repo_root, base)

    def test_accepts_canonical_quoted_metadata_with_comments_and_bom(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            path = repo_root / "docs" / "adr" / "0001-example.md"
            variant = ACCEPTED_ADR.replace(
                "doc_type: adr\nstatus: accepted",
                'doc_type: "adr" # canonical type\nstatus: \'accepted\' # lifecycle',
            )
            path.write_text("\ufeff" + variant, encoding="utf-8")
            run_git(repo_root, "add", ".")
            run_git(repo_root, "commit", "-qm", "metadata variant")
            base = set_origin_main(repo_root)
            path.write_text(
                ("\ufeff" + variant).replace("Original decision.", "Changed decision."),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "history changed"):
                validate(repo_root, base)

    def test_preserves_exact_history_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            base = initialize_repo(repo_root)
            path = repo_root / "docs" / "adr" / "0001-example.md"
            path.write_text(
                ACCEPTED_ADR.replace("Original decision.", "Original decision. "),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "history changed"):
                validate(repo_root, base)

    def test_uses_commonmark_fence_length_when_finding_sections(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            path = repo_root / "docs" / "adr" / "0001-example.md"
            fenced = ACCEPTED_ADR.replace(
                "Original context.",
                "Original context.\n\n````md\n```\n## Decision\n```\n````",
            )
            path.write_text(fenced, encoding="utf-8")
            run_git(repo_root, "add", ".")
            run_git(repo_root, "commit", "-qm", "fenced example")
            base = set_origin_main(repo_root)
            path.write_text(
                fenced.replace("Original consequences.", "Changed consequences."),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "history changed"):
                validate(repo_root, base)

    def test_rejects_non_remote_base_ref(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)

            with self.assertRaisesRegex(ValidationError, "origin remote-tracking"):
                validate(repo_root, "HEAD")

    def test_rejects_shallow_repository_history(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            source = root / "source"
            clone = root / "clone"
            source.mkdir()
            initialize_repo(source)
            subprocess.run(
                ["git", "clone", "-q", "--depth", "1", source.as_uri(), clone],
                check=True,
                capture_output=True,
            )

            with self.assertRaisesRegex(ValidationError, "complete Git history"):
                validate(clone, "origin/main")

    def test_rejects_multiple_merge_bases(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            original_run_git = validate_accepted_adrs.run_git

            def run_git_with_multiple_bases(
                root: Path, arguments: list[str]
            ) -> bytes:
                if arguments[:2] == ["merge-base", "--all"]:
                    return b"a" * 40 + b"\n" + b"b" * 40 + b"\n"
                return original_run_git(root, arguments)

            with mock.patch(
                "validate_accepted_adrs.run_git",
                side_effect=run_git_with_multiple_bases,
            ):
                with self.assertRaisesRegex(ValidationError, "one merge-base"):
                    validate(repo_root, "origin/main")

    def test_skips_large_or_non_utf8_non_adr_documents(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            (repo_root / "docs" / "large.md").write_text(
                "---\ntitle: Large non-ADR\n---\n" + "x" * (4 * 1024 * 1024),
                encoding="utf-8",
            )
            (repo_root / "docs" / "binary.md").write_bytes(b"\xff\xfe")
            run_git(repo_root, "add", ".")
            run_git(repo_root, "commit", "-qm", "non ADR documents")
            base = set_origin_main(repo_root)

            _, checked = validate(repo_root, base)

            self.assertEqual(checked, ["docs/adr/0001-example.md"])

    def test_rejects_ambiguous_metadata_in_an_adr_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            path = repo_root / "docs" / "adr" / "0001-example.md"
            path.write_text(
                ACCEPTED_ADR.replace("doc_type: adr", "doc_type: [adr]"),
                encoding="utf-8",
            )
            run_git(repo_root, "add", ".")
            run_git(repo_root, "commit", "-qm", "ambiguous metadata")
            base = set_origin_main(repo_root)

            with self.assertRaisesRegex(ValidationError, "unsupported doc_type"):
                validate(repo_root, base)

    def test_allows_a_new_accepted_adr(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            base = initialize_repo(repo_root)
            new_adr = repo_root / "docs" / "adr" / "0003-new.md"
            new_adr.write_text(ACCEPTED_ADR, encoding="utf-8")

            _, checked = validate(repo_root, base)

            self.assertEqual(checked, ["docs/adr/0001-example.md"])

    def test_rejects_symlinked_accepted_adr(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            base = initialize_repo(repo_root)
            path = repo_root / "docs" / "adr" / "0001-example.md"
            target = repo_root / "replacement.md"
            target.write_text(ACCEPTED_ADR, encoding="utf-8")
            path.unlink()
            path.symlink_to(target)

            with self.assertRaisesRegex(ValidationError, "symlinks"):
                validate(repo_root, base)

    def test_cli_accepts_relative_repo_root_without_side_effects(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            base = initialize_repo(repo_root)
            script = Path(__file__).with_name("validate_accepted_adrs.py")
            before = run_git(repo_root, "status", "--porcelain=v1")
            environment = os.environ.copy()
            environment.pop("PYTHONDONTWRITEBYTECODE", None)

            result = subprocess.run(
                [
                    sys.executable,
                    os.fspath(script),
                    "--repo-root",
                    ".",
                    "--base-ref",
                    base,
                ],
                cwd=repo_root,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("checked=1", result.stdout)
            self.assertEqual(run_git(repo_root, "status", "--porcelain=v1"), before)
            self.assertFalse(any(repo_root.rglob("__pycache__")))


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Execute v3 verification cases and capture canonical Build evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True

from artifact_source import (
    SourceError,
    require_shell_free_command,
    require_substantive_inline_text,
    write_regular_file_atomically,
)
from git_baseline import GitBaselineError, require_repository_root
from validate_build_rule_coverage import (
    VERIFICATION_GENERATOR,
    canonical_verification_path,
    final_state_sha256,
    load_receipt,
    validate_final_target_state,
)


class CaptureError(ValueError):
    pass


def parse_manual_observations(values: list[str]) -> dict[str, str]:
    observations: dict[str, str] = {}
    for value in values:
        case_id, separator, observation = value.partition("=")
        if not separator or not case_id or case_id in observations:
            raise CaptureError("manual observation must use unique VC-ID=text values")
        try:
            observations[case_id] = require_substantive_inline_text(
                observation,
                f"manual observation {case_id}",
            )
        except SourceError as error:
            raise CaptureError(str(error)) from error
    return observations


def execute_cases(
    repo_root: Path,
    cases: list[dict[str, object]],
    manual_observations: dict[str, str],
    target_state: dict[str, object],
    expected_final_state: str,
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    used_manual_ids: set[str] = set()
    environment = os.environ.copy()
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    for case in cases:
        case_id = str(case["id"])
        if case["type"] == "automated":
            try:
                command = require_shell_free_command(
                    case["command"], f"verification case {case_id} command"
                )
            except SourceError as error:
                raise CaptureError(str(error)) from error
            completed = subprocess.run(
                command,
                cwd=repo_root,
                env=environment,
                capture_output=True,
                check=False,
            )
            framed_output = (
                b"AIDD-output-v1\0"
                + len(completed.stdout).to_bytes(8, "big")
                + completed.stdout
                + len(completed.stderr).to_bytes(8, "big")
                + completed.stderr
            )
            output_sha256 = hashlib.sha256(framed_output).hexdigest()
            if completed.returncode != 0:
                raise CaptureError(
                    f"verification case {case_id} failed with exit code "
                    f"{completed.returncode}"
                )
            if final_state_sha256(repo_root, target_state) != expected_final_state:
                raise CaptureError(
                    f"verification case {case_id} modified the task-owned final state"
                )
            results.append(
                {
                    "id": case_id,
                    "type": "automated",
                    "status": "passed",
                    "command": command,
                    "exit_code": completed.returncode,
                    "stdout_bytes": len(completed.stdout),
                    "stderr_bytes": len(completed.stderr),
                    "output_sha256": output_sha256,
                }
            )
            continue
        observation = manual_observations.get(case_id)
        if observation is None:
            raise CaptureError(f"manual verification case {case_id} requires an observation")
        try:
            procedure = require_substantive_inline_text(
                case["procedure"], f"manual verification procedure {case_id}"
            )
        except SourceError as error:
            raise CaptureError(str(error)) from error
        used_manual_ids.add(case_id)
        results.append(
            {
                "id": case_id,
                "type": "manual",
                "status": "passed",
                "procedure": procedure,
                "observation": observation,
            }
        )
    unused = set(manual_observations) - used_manual_ids
    if unused:
        raise CaptureError(
            "manual observations contain unknown or automated cases: "
            + ", ".join(sorted(unused))
        )
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--expected-receipt-sha256", required=True)
    parser.add_argument("--manual-observation", action="append", default=[])
    args = parser.parse_args()
    try:
        repo_root = require_repository_root(args.repo_root)
        receipt, _ = load_receipt(
            repo_root,
            args.workspace,
            args.expected_receipt_sha256,
        )
        target_state = receipt["target_state"]["value"]
        validate_final_target_state(repo_root, target_state)
        initial_final_state = final_state_sha256(repo_root, target_state)
        results = execute_cases(
            repo_root,
            target_state["verification_cases"],
            parse_manual_observations(args.manual_observation),
            target_state,
            initial_final_state,
        )
        current_final_state = final_state_sha256(repo_root, target_state)
        if current_final_state != initial_final_state:
            raise CaptureError(
                "verification commands must not modify the task-owned final state"
            )
        evidence = {
            "schema_version": 3,
            "kind": "build_verification",
            "workspace": args.workspace,
            "receipt_sha256": args.expected_receipt_sha256,
            "final_state_sha256": initial_final_state,
            "generator": VERIFICATION_GENERATOR,
            "results": results,
        }
        output_path = canonical_verification_path(repo_root, args.workspace)
        write_regular_file_atomically(
            output_path,
            f"{json.dumps(evidence, ensure_ascii=False, indent=2)}\n",
        )
    except (
        CaptureError,
        GitBaselineError,
        OSError,
        SourceError,
        ValueError,
    ) as error:
        print(f"build verification capture: failed: {error}", file=sys.stderr)
        return 1
    print(f"build verification capture: verified: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

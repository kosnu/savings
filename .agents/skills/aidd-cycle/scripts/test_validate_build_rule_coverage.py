from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from collections.abc import Callable
from pathlib import Path

from artifact_source import serialize_source
from render_aidd_artifact import render_artifact_markdown
from test_validate_build_entry import initialize_repo, write_design_goal
from test_validate_design_coverage import WORKSPACE, design_goal_source, design_source
from validate_build_entry import canonical_receipt_path, validate_or_capture
from validate_build_rule_coverage import (
    COVERAGE_SCHEMA_VERSION,
    VERIFICATION_GENERATOR,
    ValidationError,
    canonical_verification_path,
    exported_names,
    final_state_sha256,
    literal_test_case_names,
    validate,
)
from rule_coverage import (
    expand_rule_closure,
    matching_surfaces,
    rules_for_path,
    rules_for_surfaces,
    validate_review_routing,
)
from validate_requirements_goal import validate_rule_map


def run_git(repo_root: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        check=True,
        capture_output=True,
    )


def capture(
    repo_root: Path,
    goal_path: Path | None = None,
    *,
    materialize: bool = True,
) -> str:
    issue_body_path = repo_root / "issue-body.md"
    rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
    goal_path = goal_path or write_design_goal(repo_root)
    run_git(
        repo_root,
        "add",
        "issue-body.md",
        "design-goal.json",
        "docs/harness/rule-map.json",
        "docs/ai-driven-development/workflow.md",
        "docs/harness/policies/extra.md",
    )
    run_git(repo_root, "commit", "-qm", "design baseline")
    _, receipt_sha256 = validate_or_capture(
        "owner/repo#1639",
        "https://github.com/owner/repo/issues/1639",
        "2026-08-11T00:00:00Z",
        issue_body_path,
        rule_map_path,
        repo_root,
        WORKSPACE,
        capture=True,
        goal_document_path=goal_path,
    )
    if materialize:
        write_default_target(repo_root)
        write_verification(repo_root, receipt_sha256)
    return receipt_sha256


def write_default_target(repo_root: Path) -> None:
    write_changed_file(repo_root, "apps/web/feature.ts")
    test_path = repo_root / "apps/web/feature.test.ts"
    test_path.parent.mkdir(parents=True, exist_ok=True)
    test_path.write_text(
        'import { test } from "vite-plus/test";\n'
        'test("FR-1 target", () => {});\ntest("AC-1 target", () => {});\n',
        encoding="utf-8",
    )


def write_verification(repo_root: Path, receipt_sha256: str) -> None:
    path = canonical_verification_path(repo_root, WORKSPACE)
    path.parent.mkdir(parents=True, exist_ok=True)
    design = json.loads(
        (
            repo_root
            / "docs"
            / "ai-driven-development"
            / "workspaces"
            / WORKSPACE
            / "design-doc.json"
        ).read_text(encoding="utf-8")
    )
    path.write_text(
        json.dumps(
            {
                "schema_version": 3,
                "kind": "build_verification",
                "workspace": WORKSPACE,
                "receipt_sha256": receipt_sha256,
                "final_state_sha256": final_state_sha256(
                    repo_root, design["validation"]["target_state"]
                ),
                "generator": VERIFICATION_GENERATOR,
                "results": [
                    {
                        "id": "VC-1",
                        "type": "automated",
                        "status": "passed",
                        "command": ["python3", "-c", "raise SystemExit(0)"],
                        "exit_code": 0,
                        "stdout_bytes": 0,
                        "stderr_bytes": 0,
                        "output_sha256": "0" * 64,
                    },
                    {
                        "id": "VC-2",
                        "type": "automated",
                        "status": "passed",
                        "command": ["python3", "-c", "raise SystemExit(0)"],
                        "exit_code": 0,
                        "stdout_bytes": 0,
                        "stderr_bytes": 0,
                        "output_sha256": "0" * 64,
                    },
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def add_surface(repo_root: Path, surface: dict[str, object]) -> None:
    rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
    rule_map = json.loads(rule_map_path.read_text(encoding="utf-8"))
    rule_map["review_routing"]["surfaces"].append(surface)
    rule_map_path.write_text(
        json.dumps(rule_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def set_rule_paths(repo_root: Path, rule_id: str, paths: list[str]) -> None:
    rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
    rule_map = json.loads(rule_map_path.read_text(encoding="utf-8"))
    rule = next(rule for rule in rule_map["rules"] if rule["id"] == rule_id)
    rule["applies_to"]["paths"] = paths
    rule_map_path.write_text(
        json.dumps(rule_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def set_design_surfaces(
    repo_root: Path,
    surfaces: list[str],
    *,
    additional_rules: list[dict[str, str]] | None = None,
) -> Path:
    workspace_root = (
        repo_root / "docs" / "ai-driven-development" / "workspaces" / WORKSPACE
    )
    requirements_path = workspace_root / "requirements.json"
    requirements_digest = hashlib.sha256(requirements_path.read_bytes()).hexdigest()
    design = design_source(
        requirements_digest,
        additional_rules=additional_rules,
    )
    design["validation"]["rule_coverage"]["implementation_surfaces"] = surfaces
    design_path = workspace_root / "design-doc.json"
    design_path.write_text(serialize_source(design), encoding="utf-8")
    (workspace_root / "design-doc.md").write_text(
        render_artifact_markdown(design), encoding="utf-8"
    )
    goal = design_goal_source(
        requirements_digest,
        additional_rules=additional_rules,
    )
    goal["validation"]["rule_coverage"]["implementation_surfaces"] = surfaces
    goal_path = repo_root / "design-goal.json"
    goal_path.write_text(serialize_source(goal), encoding="utf-8")
    return goal_path


def update_target_state(
    repo_root: Path,
    goal_path: Path,
    update: Callable[[dict[str, object]], None],
) -> None:
    design_path = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
        / "design-doc.json"
    )
    for path in (design_path, goal_path):
        source = json.loads(path.read_text(encoding="utf-8"))
        update(source["validation"]["target_state"])
        path.write_text(serialize_source(source), encoding="utf-8")
        if path == design_path:
            path.with_name("design-doc.md").write_text(
                render_artifact_markdown(source),
                encoding="utf-8",
            )


def write_changed_file(repo_root: Path, relative_path: str) -> None:
    path = repo_root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("export const changed = true;\n", encoding="utf-8")


class BuildRuleCoverageTest(unittest.TestCase):
    def test_repository_runner_captures_automated_verification(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            verification_path = canonical_verification_path(repo_root, WORKSPACE)
            verification_path.unlink()

            result = subprocess.run(
                [
                    sys.executable,
                    os.fspath(Path(__file__).with_name("capture_build_verification.py")),
                    "--repo-root",
                    os.fspath(repo_root),
                    "--workspace",
                    WORKSPACE,
                    "--expected-receipt-sha256",
                    receipt_sha256,
                ],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            evidence = json.loads(verification_path.read_text(encoding="utf-8"))
            self.assertEqual(evidence["generator"], VERIFICATION_GENERATOR)
            empty_output_frame = b"AIDD-output-v1\0" + (0).to_bytes(
                8, "big"
            ) * 2
            self.assertEqual(
                evidence["results"][0]["output_sha256"],
                hashlib.sha256(empty_output_frame).hexdigest(),
            )
            self.assertEqual(evidence["results"][0]["stderr_bytes"], 0)
            self.assertTrue(all(entry["status"] == "passed" for entry in evidence["results"]))

    def test_repository_runner_rejects_verification_that_mutates_final_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            goal_path = write_design_goal(repo_root)
            mutating_command = [
                "python3",
                "-c",
                "from pathlib import Path; Path('apps/web/feature.ts').write_text('changed')",
            ]
            goal = json.loads(goal_path.read_text(encoding="utf-8"))
            goal["validation"]["target_state"]["verification_cases"][0]["command"] = (
                mutating_command
            )
            goal_path.write_text(serialize_source(goal), encoding="utf-8")
            design_path = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
                / "design-doc.json"
            )
            design = json.loads(design_path.read_text(encoding="utf-8"))
            design["validation"]["target_state"]["verification_cases"][0]["command"] = (
                mutating_command
            )
            design_path.write_text(serialize_source(design), encoding="utf-8")
            design_path.with_name("design-doc.md").write_text(
                render_artifact_markdown(design), encoding="utf-8"
            )
            receipt_sha256 = capture(repo_root, goal_path)
            verification_path = canonical_verification_path(repo_root, WORKSPACE)
            verification_path.unlink()

            result = subprocess.run(
                [
                    sys.executable,
                    os.fspath(Path(__file__).with_name("capture_build_verification.py")),
                    "--repo-root",
                    os.fspath(repo_root),
                    "--workspace",
                    WORKSPACE,
                    "--expected-receipt-sha256",
                    receipt_sha256,
                ],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("modified the task-owned final state", result.stderr)
            self.assertFalse(verification_path.exists())

    def test_repository_runner_rejects_verification_that_changes_executable_mode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            goal_path = write_design_goal(repo_root)
            chmod_command = [
                "python3",
                "-c",
                "from pathlib import Path; Path('apps/web/feature.ts').chmod(0o755)",
            ]

            def set_command(target_state: dict[str, object]) -> None:
                target_state["verification_cases"][0]["command"] = chmod_command

            update_target_state(repo_root, goal_path, set_command)
            receipt_sha256 = capture(repo_root, goal_path)
            verification_path = canonical_verification_path(repo_root, WORKSPACE)
            verification_path.unlink()

            result = subprocess.run(
                [
                    sys.executable,
                    os.fspath(Path(__file__).with_name("capture_build_verification.py")),
                    "--repo-root",
                    os.fspath(repo_root),
                    "--workspace",
                    WORKSPACE,
                    "--expected-receipt-sha256",
                    receipt_sha256,
                ],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("modified the task-owned final state", result.stderr)
            self.assertFalse(verification_path.exists())

    def test_rejects_verification_captured_for_stale_final_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            (repo_root / "apps/web/feature.ts").write_text(
                "export const changed = false;\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "current final state"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_rejects_verification_captured_before_executable_mode_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            (repo_root / "apps/web/feature.ts").chmod(0o755)

            with self.assertRaisesRegex(ValidationError, "current final state"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_cli_relative_repo_root_does_not_write_bytecode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            run_git(
                repo_root,
                "add",
                str(canonical_receipt_path(repo_root, WORKSPACE).relative_to(repo_root)),
                str(canonical_verification_path(repo_root, WORKSPACE).relative_to(repo_root)),
            )
            before = set(
                subprocess.run(
                    ["git", "-C", str(repo_root), "status", "--porcelain=v1"],
                    check=True,
                    capture_output=True,
                    text=True,
                ).stdout.splitlines()
            )
            environment = os.environ.copy()
            environment.pop("PYTHONDONTWRITEBYTECODE", None)
            result = subprocess.run(
                [
                    sys.executable,
                    os.fspath(
                        Path(__file__).with_name("validate_build_rule_coverage.py")
                    ),
                    "--repo-root",
                    ".",
                    "--workspace",
                    WORKSPACE,
                    "--expected-receipt-sha256",
                    receipt_sha256,
                ],
                cwd=repo_root,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            coverage_path = (
                Path("docs")
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
                / ".aidd"
                / "build-rule-coverage.json"
            )
            after = set(
                subprocess.run(
                    ["git", "-C", str(repo_root), "status", "--porcelain=v1"],
                    check=True,
                    capture_output=True,
                    text=True,
                ).stdout.splitlines()
            )
            self.assertEqual(after - before, {f"?? {coverage_path.as_posix()}"})
            self.assertEqual(before - after, set())
            self.assertFalse(
                any(
                    path.name == "__pycache__"
                    for path in repo_root.rglob("__pycache__")
                )
            )

    def test_granular_locator_lexer_ignores_comments_strings_and_regexes(self) -> None:
        text = (
            'import { test } from "vite-plus/test";\n'
            '// export const Commented = {}; test("Commented", () => {});\n'
            'const source = \'export const StringOnly = {}; test("StringOnly")\';\n'
            'const pattern = /test("RegexOnly")/;\n'
            'if (ok) /test("ControlRegexOnly")/.test(value);\n'
            'export const Actual = {};\n'
            'test("Actual test", () => {});\n'
        )

        self.assertEqual(exported_names(text), ["Actual"])
        self.assertEqual(literal_test_case_names(text), ["Actual test"])
        with self.assertRaisesRegex(ValidationError, "must not be aliased"):
            literal_test_case_names(
                'import { test as runner } from "vite-plus/test";\n'
                'const test = (_name, _fn) => {};\n'
                'runner("real smoke", () => {});\n'
                'test("VC target", () => {});'
            )
        with self.assertRaisesRegex(ValidationError, "shadowed"):
            literal_test_case_names(
                'import { test } from "vite-plus/test";\n'
                'function helper() { const test = () => {}; test("fake", () => {}); }'
            )
        for modifier in ("skip", "todo", "only", "fails"):
            with self.subTest(modifier=modifier), self.assertRaisesRegex(
                ValidationError, "forbidden"
            ):
                literal_test_case_names(
                    'import { test } from "vite-plus/test";\n'
                    f'test.{modifier}("VC target", () => {{}});'
                )
        for table in ("[]", "cases", "[...cases]"):
            with self.subTest(table=table), self.assertRaisesRegex(
                ValidationError, "statically non-empty"
            ):
                literal_test_case_names(
                    'import { test } from "vite-plus/test";\n'
                    f'test.each({table})("VC target", () => {{}});'
                )
        self.assertEqual(
            literal_test_case_names(
                'import { test } from "vite-plus/test";\n'
                'test.each([1])("VC target", () => {});'
            ),
            ["VC target"],
        )
        self.assertEqual(
            literal_test_case_names(
                'while (ok) { break\n/test("RegexOnly")/.test(x) }'
            ),
            [],
        )
        self.assertEqual(
            literal_test_case_names(
                'outer: while (ok) { continue outer\n/test("RegexOnly")/.test(x) }'
            ),
            [],
        )
        for import_declaration in (
            'import "node:path"',
            'import path from "node:path"',
            'import { join } from "node:path"',
            "import path = Foo.x",
            'import path = require("node:path")',
        ):
            with self.subTest(import_declaration=import_declaration):
                self.assertEqual(
                    literal_test_case_names(
                        import_declaration + '\n/test("RegexOnly")/.test("x")'
                    ),
                    [],
                )

    def test_granular_export_inventory_covers_async_and_multiple_declarations(self) -> None:
        self.assertEqual(
            exported_names(
                "export const A1 = {}, A2 = {}; export async function A3() {}"
            ),
            ["A1", "A2", "A3"],
        )
        self.assertEqual(
            exported_names(
                r"export const A1 = /\(/; export const A4 = {}; const tail = /\)/;"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = (x) / 2; export const A4 = {}; "
                "/pattern/.test(x);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = obj.in / 2; export const A4 = {}; "
                "/pattern/.test(x);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = value! / 2; export const A4 = {}; "
                "/pattern/.test(1);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "class C { #in = 2; m() { return this.#in / 2; } } "
                "export const A4 = {}; /pattern/.test(1);"
            ),
            ["A4"],
        )
        self.assertEqual(
            exported_names(
                "const of = 4; export const A1 = of / 2; "
                "export const A4 = {}; /pattern/.test(1);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = value!! / 2; export const A4 = {}; "
                "/pattern/.test(1);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "for (const value of /pattern/) { use(value); } "
                "export const A4 = {};"
            ),
            ["A4"],
        )
        self.assertEqual(
            exported_names(
                "const matcher = (value: string) => /pattern/.test(value); "
                "export const A4 = {};"
            ),
            ["A4"],
        )
        self.assertEqual(
            exported_names(
                r"export const A1 = async function () { "
                r"for await (const x of xs) /\(/.test(x); }; "
                r"export const A4 = {}; async function tail() { "
                r"for await (const x of xs) /\)/.test(x); }"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = value++ / 2; export const A4 = {}; "
                "/pattern/.test(1);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                r"export const A1 = value + /\(/.source; export const A4 = {}; "
                r"const tail = value * /\)/.source;"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = obj.if(x) / 2; export const A4 = {}; "
                "/pattern/.test(1);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names("namespace Hidden { export const A4 = {}; }"),
            [],
        )
        self.assertEqual(
            exported_names(
                "export const A4 = {}; namespace Hidden { export const A4 = {}; }"
            ),
            ["A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = { render: () => <Provider><Story /></Provider> }; "
                "export const A4 = {};"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "type N<T> = number; const value = 4; "
                "export const A1 = value as N<number> / 2; "
                "export const A4 = {}; /pattern/.test(1);"
            ),
            ["A1", "A4"],
        )
        self.assertEqual(
            exported_names(
                "export const A1 = value < /pattern/.test(input); "
                "export const A4 = {};"
            ),
            ["A1", "A4"],
        )

    def test_runtime_export_inventory_excludes_type_only_exports(self) -> None:
        self.assertEqual(
            exported_names(
                "export type Story = {}; export interface Other {}; "
                "const Runtime = {}; export { type Story, Runtime };"
            ),
            ["Runtime"],
        )

    def test_runtime_export_inventory_rejects_wildcard_reexports(self) -> None:
        for source in (
            'export * from "./other";',
            'export * as Other from "./other";',
        ):
            with self.subTest(source=source), self.assertRaisesRegex(
                ValidationError, "wildcard re-exports"
            ):
                exported_names(source)

    def test_runtime_export_inventory_rejects_source_and_import_backed_reexports(self) -> None:
        for source in (
            'export { Runtime } from "./other";',
            'import { Runtime } from "./other"; export { Runtime };',
        ):
            with self.subTest(source=source), self.assertRaisesRegex(
                ValidationError, "re-export"
            ):
                exported_names(source)

    def test_runtime_export_inventory_skips_default_and_local_type_exports(self) -> None:
        self.assertEqual(
            exported_names(
                "interface Props {} export { Props }; "
                "const Runtime = {}; const Aliased = {}; "
                "export { Runtime, Aliased as default }; export default {};"
            ),
            ["Runtime"],
        )
        self.assertEqual(
            exported_names(
                "export const enum CompileTime { A } export enum Runtime { A }"
            ),
            ["Runtime"],
        )

    def test_typescript_representation_uses_ts_parser_mode(self) -> None:
        self.assertEqual(
            exported_names(
                "export const identity = <T>(value: T) => value;",
                "apps/web/identity.ts",
            ),
            ["identity"],
        )

    def test_finds_literal_test_cases_in_tsx(self) -> None:
        self.assertEqual(
            literal_test_case_names(
                'import { test } from "vite-plus/test"; '
                'test("renders", () => { render(<Provider><Story /></Provider>); });'
            ),
            ["renders"],
        )

    def test_rejects_tests_that_are_not_statically_registered(self) -> None:
        for body in (
            'if (false) test("hidden", () => {});',
            'function register() { test("hidden", () => {}); }',
            'describe.skip("hidden", () => { test("hidden", () => {}); });',
            'test("outer", () => { test("hidden", () => {}); });',
        ):
            with self.subTest(body=body), self.assertRaises(ValidationError):
                literal_test_case_names(
                    'import { describe, test } from "vite-plus/test";\n' + body
                )

    def test_rejects_aliased_and_namespace_runner_calls(self) -> None:
        for source in (
            'import { test as hidden } from "vite-plus/test"; hidden("x", () => {});',
            'import * as runner from "vite-plus/test"; runner.test("x", () => {});',
            'import { test } from "vite-plus/test"; test["skip"]("x", () => {});',
            'import { test } from "vite-plus/test"; const hidden = test; hidden("x", () => {});',
            'const runner = await import("vite-plus/test"); runner.test("x", () => {});',
        ):
            with self.subTest(source=source), self.assertRaises(ValidationError):
                literal_test_case_names(source)

    def test_ignores_calls_without_an_approved_runner_import(self) -> None:
        self.assertEqual(literal_test_case_names('test("x", () => {});'), [])

    def test_rejects_test_cases_without_inline_function_callbacks(self) -> None:
        for call in (
            'test("missing");',
            'test("non-function", callback);',
            'test.each([1])("missing each");',
        ):
            with self.subTest(call=call), self.assertRaisesRegex(
                ValidationError,
                "inline function callback",
            ):
                literal_test_case_names(
                    'import { test } from "vite-plus/test";\n' + call
                )

    def test_accepts_tests_in_direct_describe_callback(self) -> None:
        self.assertEqual(
            literal_test_case_names(
                'import { describe, test } from "vite-plus/test";\n'
                'describe("group", () => { test("registered", () => {}); });'
            ),
            ["registered"],
        )

    def test_rejects_unreachable_tests_in_direct_describe_callback(self) -> None:
        for body in (
            'return; test("hidden", () => {});',
            'if (condition) return; test("hidden", () => {});',
            'throw new Error("stop"); test("hidden", () => {});',
        ):
            source = (
                'import { describe, test } from "vite-plus/test";\n'
                f'describe("group", () => {{ {body} }});'
            )
            with self.subTest(body=body), self.assertRaisesRegex(
                ValidationError, "unreachable"
            ):
                literal_test_case_names(source)

    def test_rejects_test_case_hidden_in_export_locator_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            goal_path = write_design_goal(repo_root)

            def use_export_locator(target_state: dict[str, object]) -> None:
                target_state["representations"][0]["locator"] = {
                    "kind": "export",
                    "name": "changed",
                }

            update_target_state(repo_root, goal_path, use_export_locator)
            receipt_sha256 = capture(repo_root, goal_path)
            (repo_root / "apps/web/feature.ts").write_text(
                'import { test } from "vite-plus/test";\n'
                "export const changed = true;\n"
                'test("hidden case", () => {});\n',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "extra=.*hidden case"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_rejects_export_hidden_in_test_case_locator_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            test_path = repo_root / "apps/web/feature.test.ts"
            test_path.write_text(
                test_path.read_text(encoding="utf-8")
                + "export const Hidden = true;\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "extra=.*Hidden"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_accepts_fully_declared_mixed_granular_representations(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            goal_path = write_design_goal(repo_root)

            def add_export_representation(target_state: dict[str, object]) -> None:
                target_state["representations"].append(
                    {
                        "id": "REP-4",
                        "kind": "implementation",
                        "path": "apps/web/feature.test.ts",
                        "locator": {"kind": "export", "name": "Helper"},
                        "requirement_id": "AC-1",
                        "product_behavior_ids": [],
                        "verification_case_ids": [],
                    }
                )

            update_target_state(repo_root, goal_path, add_export_representation)
            receipt_sha256 = capture(repo_root, goal_path)
            test_path = repo_root / "apps/web/feature.test.ts"
            test_path.write_text(
                test_path.read_text(encoding="utf-8")
                + "export const Helper = true;\n",
                encoding="utf-8",
            )
            write_verification(repo_root, receipt_sha256)

            record = validate(repo_root, WORKSPACE, receipt_sha256)

            self.assertIn(
                {
                    "path": "apps/web/feature.test.ts",
                    "locator": "export",
                    "name": "Helper",
                },
                record["representations"],
            )

    def test_rejects_unlisted_story_export_until_final_state_is_materialized(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            requirements_path = workspace_root / "requirements.json"
            requirements_digest = hashlib.sha256(requirements_path.read_bytes()).hexdigest()
            story_path = "apps/web/Feature.stories.tsx"
            story_target = {
                "product_behaviors": [
                    {"id": "PB-1", "type": "state_transition", "requirement_id": "FR-1"}
                ],
                "verification_cases": [
                    {
                        "id": "VC-1",
                        "type": "automated",
                        "command": ["python3", "-c", "raise SystemExit(0)"],
                        "requirement_id": "FR-1",
                        "product_behavior_ids": ["PB-1"],
                    },
                    {
                        "id": "VC-2",
                        "type": "automated",
                        "command": ["python3", "-c", "raise SystemExit(0)"],
                        "requirement_id": "AC-1",
                        "product_behavior_ids": [],
                    },
                ],
                "ownership_scopes": [{"path": story_path, "kind": "file"}],
                "representations": [
                    {
                        "id": "REP-1",
                        "kind": "story",
                        "path": story_path,
                        "locator": {"kind": "export", "name": "A1"},
                        "requirement_id": "FR-1",
                        "product_behavior_ids": ["PB-1"],
                        "verification_case_ids": ["VC-1"],
                    },
                    {
                        "id": "REP-2",
                        "kind": "story",
                        "path": story_path,
                        "locator": {"kind": "export", "name": "A2"},
                        "requirement_id": "AC-1",
                        "product_behavior_ids": [],
                        "verification_case_ids": ["VC-2"],
                    },
                    {
                        "id": "REP-3",
                        "kind": "story",
                        "path": story_path,
                        "locator": {"kind": "export", "name": "A3"},
                        "requirement_id": "FR-1",
                        "product_behavior_ids": [],
                        "verification_case_ids": [],
                    },
                ],
            }
            design = design_source(requirements_digest)
            design["validation"]["target_state"] = story_target
            design_path = workspace_root / "design-doc.json"
            design_path.write_text(serialize_source(design), encoding="utf-8")
            (workspace_root / "design-doc.md").write_text(
                render_artifact_markdown(design), encoding="utf-8"
            )
            goal = design_goal_source(requirements_digest)
            goal["validation"]["target_state"] = story_target
            goal_path = repo_root / "design-goal.json"
            goal_path.write_text(serialize_source(goal), encoding="utf-8")
            path = repo_root / story_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                "export const A1 = {};\nexport const A2 = {};\n"
                "export const A3 = {};\n// export const CommentedOut = {};\n"
                "const A4 = {};\nexport { A4 };\n",
                encoding="utf-8",
            )
            run_git(repo_root, "add", story_path)
            receipt_sha256 = capture(repo_root, goal_path, materialize=False)
            write_verification(repo_root, receipt_sha256)

            with self.assertRaisesRegex(ValidationError, "extra=.*A4"):
                validate(repo_root, WORKSPACE, receipt_sha256)

            path.write_text(
                "export const A1 = {};\nexport const A2 = {};\nexport const A3 = {};\n",
                encoding="utf-8",
            )
            write_verification(repo_root, receipt_sha256)
            record = validate(repo_root, WORKSPACE, receipt_sha256)
            self.assertEqual(
                [entry["name"] for entry in record["representations"]],
                ["A1", "A2", "A3"],
            )
            self.assertNotIn("A4", json.dumps(record, ensure_ascii=False))

    def test_rejects_unlisted_test_each_case(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            test_path = repo_root / "apps/web/feature.test.ts"
            test_path.write_text(
                test_path.read_text(encoding="utf-8")
                + 'test.each([1, 2])("A4 case", () => {});\n',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "extra=.*A4 case"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_rejects_commented_out_target_test_cases(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            test_path = repo_root / "apps/web/feature.test.ts"
            test_path.write_text(
                '// test("FR-1 target", () => {});\n'
                '/* test.each([1])("AC-1 target", () => {}); */\n',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "missing="):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_rejects_unstructured_automated_verification_claim(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            verification_path = canonical_verification_path(repo_root, WORKSPACE)
            evidence = json.loads(verification_path.read_text(encoding="utf-8"))
            evidence["results"][0] = {
                "id": "VC-1",
                "status": "passed",
                "evidence": "claimed success",
            }
            verification_path.write_text(
                json.dumps(evidence, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "invalid keys"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_rejects_noncanonical_workspace_before_build_output_resolution(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)

            with self.assertRaisesRegex(Exception, "workspace"):
                canonical_verification_path(repo_root, "../outside")

    def test_accepts_actual_diff_covered_by_design_surface(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            write_changed_file(repo_root, "apps/web/feature.ts")

            record = validate(repo_root, WORKSPACE, receipt_sha256)

            self.assertEqual(record["schema_version"], COVERAGE_SCHEMA_VERSION)
            self.assertEqual(record["implementation_surfaces"], ["test-workflow"])
            self.assertEqual(record["changes"][0]["path_rules"], [])
            self.assertEqual(record["direct_rules"], ["ai-driven.workflow"])
            self.assertEqual(record["checked_rules"], ["ai-driven.workflow"])
            self.assertEqual(record["unresolved"], [])

    def test_rejects_path_rule_missing_from_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            set_rule_paths(repo_root, "policy.extra", ["apps/web/feature.ts"])
            with self.assertRaisesRegex(Exception, "additional Design rules"):
                capture(repo_root)

    def test_accepts_path_rule_declared_as_design_additional_rule(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            set_rule_paths(repo_root, "policy.extra", ["apps/web/feature.ts"])
            goal_path = set_design_surfaces(
                repo_root,
                ["test-workflow"],
                additional_rules=[
                    {
                        "id": "policy.extra",
                        "reason": "予定pathに固有のruleであるため。",
                    }
                ],
            )
            receipt_sha256 = capture(repo_root, goal_path)

            record = validate(repo_root, WORKSPACE, receipt_sha256)

            feature_change = next(
                change
                for change in record["changes"]
                if change["path"] == "apps/web/feature.ts"
            )
            self.assertEqual(feature_change["path_rules"], ["policy.extra"])
            self.assertEqual(
                record["direct_rules"],
                ["ai-driven.workflow", "policy.extra"],
            )
            self.assertEqual(
                record["checked_rules"],
                ["ai-driven.workflow", "policy.extra"],
            )

    def test_ungoverned_build_path_still_resolves_path_specific_rules(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
            rule_map = json.loads(rule_map_path.read_text(encoding="utf-8"))
            rule_map["review_routing"]["governed_paths"] = ["apps/api/**"]
            rule_map_path.write_text(
                json.dumps(rule_map, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            set_rule_paths(repo_root, "policy.extra", ["apps/web/feature.ts"])
            goal_path = set_design_surfaces(
                repo_root,
                [],
                additional_rules=[
                    {
                        "id": "policy.extra",
                        "reason": "ungoverned pathにも固有ruleが適用されるため。",
                    }
                ],
            )
            receipt_sha256 = capture(repo_root, goal_path)

            record = validate(repo_root, WORKSPACE, receipt_sha256)

            feature_change = next(
                change
                for change in record["changes"]
                if change["path"] == "apps/web/feature.ts"
            )
            self.assertFalse(feature_change["governed"])
            self.assertEqual(feature_change["surfaces"], [])
            self.assertEqual(feature_change["path_rules"], ["policy.extra"])
            self.assertIn("policy.extra", record["checked_rules"])

    def test_rejects_surface_found_only_in_actual_diff(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            add_surface(
                repo_root,
                {
                    "id": "special-surface",
                    "paths": ["apps/special/**"],
                    "required_rules": ["ai-driven.workflow"],
                },
            )
            receipt_sha256 = capture(repo_root)
            write_changed_file(repo_root, "apps/special/feature.ts")

            with self.assertRaisesRegex(ValidationError, "exceeds task-owned scope"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_rejects_required_rule_missing_from_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            receipt_path = canonical_receipt_path(repo_root, WORKSPACE)
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            receipt["selected_rules"] = [
                entry
                for entry in receipt["selected_rules"]
                if entry["id"] != "ai-driven.workflow"
            ]
            receipt_path.write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            forged_sha256 = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
            write_verification(repo_root, forged_sha256)

            with self.assertRaisesRegex(ValidationError, "absent from the Design receipt"):
                validate(repo_root, WORKSPACE, forged_sha256)

    def test_rejects_governed_path_without_surface(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
            rule_map = json.loads(rule_map_path.read_text(encoding="utf-8"))
            rule_map["review_routing"]["surfaces"][0]["paths"] = ["apps/web/**"]
            rule_map_path.write_text(
                json.dumps(rule_map, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            receipt_sha256 = capture(repo_root)
            write_changed_file(repo_root, "apps/api/unknown.sql")

            with self.assertRaisesRegex(ValidationError, "exceeds task-owned scope"):
                validate(repo_root, WORKSPACE, receipt_sha256)


class CanonicalRoutingTest(unittest.TestCase):
    def test_rejects_ambiguous_double_star_rule_pattern(self) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        rule_map = json.loads(
            (repo_root / "docs" / "harness" / "rule-map.json").read_text(
                encoding="utf-8"
            )
        )
        rules_by_id = validate_rule_map(rule_map)
        rules_by_id["policy.code-review"]["applies_to"]["paths"] = [
            "apps/**foo/*.tsx"
        ]

        with self.assertRaisesRegex(Exception, "complete path segment"):
            validate_review_routing(rule_map, rules_by_id)

    def test_rejects_malformed_character_class_rule_pattern(self) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        rule_map = json.loads(
            (repo_root / "docs" / "harness" / "rule-map.json").read_text(
                encoding="utf-8"
            )
        )
        rules_by_id = validate_rule_map(rule_map)
        rules_by_id["policy.code-review"]["applies_to"]["paths"] = ["apps/["]

        with self.assertRaisesRegex(Exception, "character class"):
            validate_review_routing(rule_map, rules_by_id)

    def test_double_star_matches_zero_or_more_directories(self) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        rule_map = json.loads(
            (repo_root / "docs" / "harness" / "rule-map.json").read_text(
                encoding="utf-8"
            )
        )
        routing = validate_review_routing(rule_map, validate_rule_map(rule_map))

        self.assertIn(
            "web-storybook",
            matching_surfaces("apps/web/src/Button.stories.tsx", routing),
        )
        self.assertIn(
            "web-storybook",
            matching_surfaces(
                "apps/web/src/components/Button/Button.stories.tsx", routing
            ),
        )

    def test_web_tsx_surface_requires_design_rules(self) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        rule_map = json.loads(
            (repo_root / "docs" / "harness" / "rule-map.json").read_text(
                encoding="utf-8"
            )
        )
        rules_by_id = validate_rule_map(rule_map)
        routing = validate_review_routing(rule_map, rules_by_id)

        surfaces = matching_surfaces(
            "apps/web/src/features/settings/LanguageForm.tsx",
            routing,
        )
        selected_rules = expand_rule_closure(
            [
                *rules_for_surfaces(surfaces, routing),
                *rules_for_path(
                    "apps/web/src/features/settings/LanguageForm.tsx",
                    rules_by_id,
                ),
            ],
            rules_by_id,
        )

        self.assertEqual(surfaces, ["web-project", "web-source"])
        self.assertIn("web.design-rules", selected_rules)
        self.assertIn("web.test-policy", selected_rules)

    def test_msw_handler_path_selects_path_specific_rule(self) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        rule_map = json.loads(
            (repo_root / "docs" / "harness" / "rule-map.json").read_text(
                encoding="utf-8"
            )
        )
        rules_by_id = validate_rule_map(rule_map)

        selected_rules = rules_for_path(
            "apps/web/src/test/msw/handlers/profile.ts",
            rules_by_id,
        )
        ordinary_rules = rules_for_path(
            "apps/web/src/features/settings/LanguageForm.tsx",
            rules_by_id,
        )

        self.assertIn("web.msw-handlers", selected_rules)
        self.assertNotIn("web.msw-handlers", ordinary_rules)


if __name__ == "__main__":
    unittest.main()

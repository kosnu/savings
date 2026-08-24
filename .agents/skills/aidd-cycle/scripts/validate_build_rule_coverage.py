#!/usr/bin/env python3
"""Validate Build rule coverage from the actual Git diff."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from artifact_source import (
    SourceError,
    decode_source_json,
    inventory_owned_paths,
    read_regular_file_bytes,
    structured_sha256,
    write_regular_file_atomically,
)
from git_baseline import (
    GitBaselineError,
    require_canonical_worktree_path,
    require_repository_root,
    run_git,
)
from rule_coverage import (
    RuleCoverageError,
    expand_rule_closure,
    matching_surfaces,
    path_is_governed,
    rules_for_path,
    rules_for_surfaces,
    validate_review_routing,
)
from validate_build_entry import canonical_receipt_path
from validate_requirements_goal import ValidationError as RuleMapValidationError
from validate_requirements_goal import validate_rule_map


COVERAGE_SCHEMA_VERSION = 3
COVERAGE_RELATIVE_PATH = Path(".aidd") / "build-rule-coverage.json"
VERIFICATION_RELATIVE_PATH = Path(".aidd") / "build-verification.json"
IDENTIFIER_PATTERN = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")
ALLOWED_TEST_MODIFIERS = {"concurrent"}
FORBIDDEN_FINAL_TEST_MODIFIERS = {"only", "skip", "todo", "fails"}
APPROVED_TEST_RUNNER_MODULES = {"vite-plus/test"}
REGEX_PREFIX_IDENTIFIERS = {
    "return",
    "case",
    "throw",
    "yield",
    "await",
    "else",
    "do",
    "typeof",
    "instanceof",
    "in",
    "delete",
    "void",
    "new",
    "extends",
    "default",
}
CONTROL_HEAD_IDENTIFIERS = {"if", "while", "for", "with", "switch", "catch"}


class ValidationError(ValueError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_coverage_path(repo_root: Path, workspace: str) -> Path:
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / COVERAGE_RELATIVE_PATH
    )


def canonical_verification_path(repo_root: Path, workspace: str) -> Path:
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / VERIFICATION_RELATIVE_PATH
    )


def load_verification_results(
    repo_root: Path,
    workspace: str,
    receipt_sha256: str,
    target_state: dict[str, Any],
) -> tuple[list[dict[str, Any]], bytes]:
    path = canonical_verification_path(repo_root, workspace)
    raw = read_regular_file_bytes(path)
    try:
        source = decode_source_json(raw.decode("utf-8"))
    except UnicodeDecodeError as error:
        raise ValidationError("Build verification evidence must be UTF-8 JSON") from error
    if not isinstance(source, dict) or set(source) != {
        "schema_version", "kind", "workspace", "receipt_sha256", "results"
    }:
        raise ValidationError("Build verification evidence has invalid keys")
    if source["schema_version"] != 3 or source["kind"] != "build_verification":
        raise ValidationError("Build verification evidence requires schema_version 3")
    if source["workspace"] != workspace or source["receipt_sha256"] != receipt_sha256:
        raise ValidationError("Build verification evidence identity does not match")
    expected_ids = [entry["id"] for entry in target_state["verification_cases"]]
    results = source["results"]
    if not isinstance(results, list) or [
        entry.get("id") if isinstance(entry, dict) else None for entry in results
    ] != expected_ids:
        raise ValidationError("Build verification must cover every target verification case in order")
    for index, (case, entry) in enumerate(
        zip(target_state["verification_cases"], results, strict=True)
    ):
        if case["type"] == "automated":
            if set(entry) != {
                "id",
                "type",
                "status",
                "command",
                "exit_code",
                "output_sha256",
            }:
                raise ValidationError(
                    f"automated Build verification result {index} has invalid keys"
                )
            digest = entry["output_sha256"]
            if (
                entry["type"] != "automated"
                or entry["status"] != "passed"
                or entry["command"] != case["command"]
                or type(entry["exit_code"]) is not int
                or entry["exit_code"] != 0
                or not isinstance(digest, str)
                or re.fullmatch(r"[0-9a-f]{64}", digest) is None
            ):
                raise ValidationError(
                    f"automated verification evidence does not match target: {entry['id']}"
                )
        else:
            if set(entry) != {
                "id",
                "type",
                "status",
                "procedure",
                "observation",
            }:
                raise ValidationError(
                    f"manual Build verification result {index} has invalid keys"
                )
            if (
                entry["type"] != "manual"
                or entry["status"] != "passed"
                or entry["procedure"] != case["procedure"]
                or not isinstance(entry["observation"], str)
                or not entry["observation"].strip()
            ):
                raise ValidationError(
                    f"manual verification evidence does not match target: {entry['id']}"
                )
    return results, raw


def representation_identity(entry: dict[str, Any]) -> tuple[str, str, str]:
    locator = entry["locator"]
    return entry["path"], locator["kind"], locator.get("name", "")


def token_ends_javascript_expression(token: tuple[str, str]) -> bool:
    kind, value = token
    return (
        kind in {"identifier", "string", "template", "regex", "postfix"}
        or token in {("punctuation", ")"), ("punctuation", "]")}
        or (kind == "punctuation" and value.isdigit())
    )


def javascript_tokens(
    text: str, *, mask_regular_expressions: bool = True
) -> list[tuple[str, str]]:
    """Tokenize the JS/TS subset needed for export and literal test locators."""

    tokens: list[tuple[str, str]] = []
    parenthesis_contexts: list[str] = []
    regex_allowed_after_control = False
    line_terminator_since_token = False
    import_declaration_active = False
    import_declaration_can_end = False
    import_equals_active = False
    index = 0
    while index < len(text):
        character = text[index]
        if character.isspace():
            if character in {"\n", "\r", "\u2028", "\u2029"}:
                line_terminator_since_token = True
            index += 1
            continue
        if text.startswith("//", index):
            newline = text.find("\n", index + 2)
            if newline == -1:
                index = len(text)
            else:
                line_terminator_since_token = True
                index = newline + 1
            continue
        if text.startswith("/*", index):
            end = text.find("*/", index + 2)
            if end == -1:
                raise ValidationError("unterminated JavaScript block comment")
            if any(marker in text[index : end + 2] for marker in ("\n", "\r", "\u2028", "\u2029")):
                line_terminator_since_token = True
            index = end + 2
            continue
        if (
            import_declaration_active
            and import_declaration_can_end
            and line_terminator_since_token
            and character not in {"/", "."}
            and not (import_equals_active and character in {"(", ")"})
            and re.match(r"(?:with|assert)\b", text[index:]) is None
        ):
            import_declaration_active = False
            import_declaration_can_end = False
            import_equals_active = False
        if (
            mask_regular_expressions
            and character == "/"
            and tokens
            and tokens[-1] == ("punctuation", "}")
        ):
            raise ValidationError(
                "ambiguous slash after closing brace in granular representation file"
            )
        if (
            mask_regular_expressions
            and character == "/"
            and tokens
            and tokens[-1]
            in {("punctuation", "."), ("punctuation", "#")}
        ):
            raise ValidationError(
                "unsupported slash after member punctuation in granular representation file"
            )
        if (
            mask_regular_expressions
            and character == "/"
            and tokens
            and tokens[-1]
            in {("punctuation", "<"), ("punctuation", ">")}
            and not (
                tokens[-1] == ("punctuation", ">")
                and len(tokens) >= 2
                and tokens[-2] == ("punctuation", "=")
            )
        ):
            raise ValidationError(
                "ambiguous slash after angle bracket in granular representation file"
            )
        if mask_regular_expressions and character == "/" and (
            not tokens
            or regex_allowed_after_control
            or (
                import_declaration_active
                and line_terminator_since_token
            )
            or (
                line_terminator_since_token
                and (
                    tokens[-1]
                    in {
                        ("identifier", "break"),
                        ("identifier", "continue"),
                        ("identifier", "debugger"),
                    }
                    or (
                        len(tokens) >= 2
                        and tokens[-2]
                        in {
                            ("identifier", "break"),
                            ("identifier", "continue"),
                        }
                        and tokens[-1][0] == "identifier"
                    )
                )
            )
            or (
                tokens[-1][0] == "identifier"
                and tokens[-1][1] in REGEX_PREFIX_IDENTIFIERS
                and (
                    len(tokens) < 2
                    or tokens[-2]
                    not in {("punctuation", "."), ("punctuation", "#")}
                )
            )
            or (
                tokens[-1] == ("identifier", "of")
                and parenthesis_contexts
                and parenthesis_contexts[-1] == "for"
            )
            or (
                tokens[-1] == ("punctuation", ">")
                and len(tokens) >= 2
                and tokens[-2] == ("punctuation", "=")
            )
            or not token_ends_javascript_expression(tokens[-1])
        ):
            index += 1
            escaped = False
            in_character_class = False
            while index < len(text):
                current = text[index]
                if current == "\n" and not escaped:
                    raise ValidationError("unterminated JavaScript regular expression")
                if current == "[" and not escaped:
                    in_character_class = True
                elif current == "]" and not escaped:
                    in_character_class = False
                elif current == "/" and not escaped and not in_character_class:
                    index += 1
                    while index < len(text) and text[index].isalpha():
                        index += 1
                    tokens.append(("regex", ""))
                    regex_allowed_after_control = False
                    line_terminator_since_token = False
                    import_declaration_active = False
                    import_declaration_can_end = False
                    import_equals_active = False
                    break
                if current == "\\" and not escaped:
                    escaped = True
                else:
                    escaped = False
                index += 1
            else:
                raise ValidationError("unterminated JavaScript regular expression")
            continue
        if character in {"'", '"'}:
            quote = character
            index += 1
            start = index
            escaped = False
            while index < len(text):
                current = text[index]
                if current == quote and not escaped:
                    previous_token = tokens[-1] if tokens else None
                    tokens.append(("string", text[start:index]))
                    if import_declaration_active and previous_token in {
                        ("identifier", "import"),
                        ("identifier", "from"),
                    }:
                        import_declaration_can_end = True
                    index += 1
                    regex_allowed_after_control = False
                    line_terminator_since_token = False
                    break
                if current == "\n" and not escaped:
                    raise ValidationError("unterminated JavaScript string literal")
                if current == "\\" and not escaped:
                    escaped = True
                else:
                    escaped = False
                index += 1
            else:
                raise ValidationError("unterminated JavaScript string literal")
            continue
        if character == "`":
            index += 1
            escaped = False
            while index < len(text):
                current = text[index]
                if current == "`" and not escaped:
                    tokens.append(("template", ""))
                    index += 1
                    regex_allowed_after_control = False
                    line_terminator_since_token = False
                    break
                if current == "\\" and not escaped:
                    escaped = True
                else:
                    escaped = False
                index += 1
            else:
                raise ValidationError("unterminated JavaScript template literal")
            continue
        identifier = IDENTIFIER_PATTERN.match(text, index)
        if identifier is not None:
            identifier_value = identifier.group(0)
            tokens.append(("identifier", identifier_value))
            if identifier_value == "import":
                import_declaration_active = True
                import_declaration_can_end = False
                import_equals_active = False
            elif import_equals_active:
                import_declaration_can_end = True
            index = identifier.end()
            regex_allowed_after_control = False
            line_terminator_since_token = False
            continue
        if text.startswith(("++", "--"), index):
            operator = text[index : index + 2]
            kind = (
                "postfix"
                if tokens and token_ends_javascript_expression(tokens[-1])
                else "prefix"
            )
            tokens.append((kind, operator))
            regex_allowed_after_control = False
            line_terminator_since_token = False
            index += 2
            continue
        if (
            character == "!"
            and tokens
            and (
                tokens[-1][0]
                in {"identifier", "string", "template", "regex", "postfix"}
                or tokens[-1]
                in {
                    ("punctuation", ")"),
                    ("punctuation", "]"),
                    ("punctuation", "}"),
                }
            )
        ):
            # TypeScript postfix non-null assertion. Keeping it distinct from
            # prefix `!` prevents a following division slash from being masked
            # as a regular expression.
            tokens.append(("postfix", "!"))
            regex_allowed_after_control = False
            line_terminator_since_token = False
            index += 1
            continue
        if character == "(":
            if tokens and tokens[-1] == ("identifier", "import"):
                import_declaration_active = False
                import_declaration_can_end = False
                import_equals_active = False
            elif import_equals_active:
                import_declaration_can_end = False
            context = (
                tokens[-1][1]
                if tokens
                and tokens[-1][0] == "identifier"
                and tokens[-1][1] in CONTROL_HEAD_IDENTIFIERS
                and (
                    len(tokens) < 2
                    or tokens[-2]
                    not in {("punctuation", "."), ("punctuation", "#")}
                )
                else "for"
                if len(tokens) >= 2
                and tokens[-2:] == [
                    ("identifier", "for"),
                    ("identifier", "await"),
                ]
                else "ordinary"
            )
            parenthesis_contexts.append(context)
            regex_allowed_after_control = False
        elif character == ")":
            if not parenthesis_contexts:
                raise ValidationError("unbalanced JavaScript parentheses")
            regex_allowed_after_control = (
                parenthesis_contexts.pop() in CONTROL_HEAD_IDENTIFIERS
            )
            if import_equals_active:
                import_declaration_can_end = True
        elif character == "." and tokens and tokens[-1] == ("identifier", "import"):
            import_declaration_active = False
            import_declaration_can_end = False
            import_equals_active = False
            regex_allowed_after_control = False
        elif character == "." and import_equals_active:
            import_declaration_can_end = False
            regex_allowed_after_control = False
        elif character == "=" and import_declaration_active:
            import_equals_active = True
            import_declaration_can_end = False
            regex_allowed_after_control = False
        elif character == ";" and import_declaration_active:
            import_declaration_active = False
            import_declaration_can_end = False
            import_equals_active = False
            regex_allowed_after_control = False
        else:
            regex_allowed_after_control = False
        tokens.append(("punctuation", character))
        line_terminator_since_token = False
        index += 1
    return tokens


def skip_balanced_parentheses(
    tokens: list[tuple[str, str]], index: int
) -> int | None:
    if index >= len(tokens) or tokens[index] != ("punctuation", "("):
        return None
    depth = 0
    for cursor in range(index, len(tokens)):
        token = tokens[cursor]
        if token == ("punctuation", "("):
            depth += 1
        elif token == ("punctuation", ")"):
            depth -= 1
            if depth == 0:
                return cursor + 1
    raise ValidationError("unbalanced JavaScript parentheses")


def exported_names(text: str) -> list[str]:
    tokens = javascript_tokens(text)
    names: list[str] = []
    declaration_kinds = {
        "const",
        "let",
        "var",
        "function",
        "class",
        "type",
        "interface",
        "enum",
        "namespace",
        "module",
    }
    index = 0
    brace_depth = 0
    while index < len(tokens):
        if tokens[index] == ("punctuation", "{"):
            brace_depth += 1
            index += 1
            continue
        if tokens[index] == ("punctuation", "}"):
            brace_depth -= 1
            if brace_depth < 0:
                raise ValidationError("unbalanced JavaScript braces")
            index += 1
            continue
        if tokens[index] != ("identifier", "export"):
            index += 1
            continue
        if brace_depth != 0:
            index += 1
            continue
        cursor = index + 1
        if cursor < len(tokens) and tokens[cursor] == ("identifier", "declare"):
            cursor += 1
        if cursor < len(tokens) and tokens[cursor] == ("identifier", "default"):
            index = cursor + 1
            continue
        if cursor < len(tokens) and tokens[cursor] == ("identifier", "async"):
            cursor += 1
        if (
            cursor < len(tokens)
            and tokens[cursor] == ("identifier", "type")
            and cursor + 1 < len(tokens)
            and tokens[cursor + 1] == ("punctuation", "{")
        ):
            cursor += 1
        if cursor < len(tokens) and tokens[cursor][0] == "identifier":
            declaration_kind = tokens[cursor][1]
            if declaration_kind in {"const", "let", "var"}:
                cursor += 1
                expect_name = True
                depth = 0
                while cursor < len(tokens):
                    token = tokens[cursor]
                    if token == ("identifier", "export") and depth == 0:
                        break
                    if expect_name:
                        if token[0] != "identifier":
                            raise ValidationError(
                                "granular export locator requires identifier variable declarations"
                            )
                        names.append(token[1])
                        expect_name = False
                    elif token[0] == "punctuation":
                        if token[1] in "([{":
                            depth += 1
                        elif token[1] in ")]}":
                            depth -= 1
                        elif token[1] == "," and depth == 0:
                            expect_name = True
                        elif token[1] == ";" and depth == 0:
                            cursor += 1
                            break
                    cursor += 1
                if expect_name or depth != 0:
                    raise ValidationError("unsupported granular export declaration")
                index = cursor
                continue
            if (
                declaration_kind in declaration_kinds - {"const", "let", "var"}
                and cursor + 1 < len(tokens)
                and tokens[cursor + 1][0] == "identifier"
            ):
                names.append(tokens[cursor + 1][1])
                index = cursor + 2
                continue
        if cursor < len(tokens) and tokens[cursor] == ("punctuation", "{"):
            cursor += 1
            specifier: list[tuple[str, str]] = []
            while cursor < len(tokens) and tokens[cursor] != ("punctuation", "}"):
                if tokens[cursor] == ("punctuation", ","):
                    identifiers = [
                        value for kind, value in specifier if kind == "identifier"
                    ]
                    if identifiers:
                        names.append(identifiers[-1])
                    specifier = []
                else:
                    specifier.append(tokens[cursor])
                cursor += 1
            identifiers = [
                value for kind, value in specifier if kind == "identifier"
            ]
            if identifiers:
                names.append(identifiers[-1])
            index = cursor + 1
            continue
        raise ValidationError(
            "unsupported export syntax in granular representation file"
        )
    if brace_depth != 0:
        raise ValidationError("unbalanced JavaScript braces")
    return names


def direct_test_runner_bindings(
    tokens: list[tuple[str, str]],
) -> tuple[set[str], set[int]]:
    bindings: set[str] = set()
    import_token_indexes: set[int] = set()
    index = 0
    while index < len(tokens):
        if tokens[index] != ("identifier", "import"):
            index += 1
            continue
        start = index
        cursor = index + 1
        if cursor >= len(tokens) or tokens[cursor] != ("punctuation", "{"):
            index += 1
            continue
        cursor += 1
        specifiers: list[list[tuple[str, str]]] = []
        specifier: list[tuple[str, str]] = []
        while cursor < len(tokens) and tokens[cursor] != ("punctuation", "}"):
            if tokens[cursor] == ("punctuation", ","):
                specifiers.append(specifier)
                specifier = []
            else:
                specifier.append(tokens[cursor])
            cursor += 1
        if cursor >= len(tokens):
            raise ValidationError("unterminated test runner import")
        specifiers.append(specifier)
        cursor += 1
        if (
            cursor + 1 >= len(tokens)
            or tokens[cursor] != ("identifier", "from")
            or tokens[cursor + 1][0] != "string"
        ):
            index = cursor
            continue
        end = cursor + 2
        import_token_indexes.update(range(start, end))
        if tokens[cursor + 1][1] in APPROVED_TEST_RUNNER_MODULES:
            for entry in specifiers:
                if len(entry) == 1 and entry[0] in {
                    ("identifier", "test"),
                    ("identifier", "it"),
                }:
                    bindings.add(entry[0][1])
        index = end
    return bindings, import_token_indexes


def literal_test_case_names(text: str) -> list[str]:
    tokens = javascript_tokens(text)
    runner_bindings, import_token_indexes = direct_test_runner_bindings(tokens)
    names: list[str] = []
    for index, token in enumerate(tokens):
        if token not in {("identifier", "test"), ("identifier", "it")}:
            continue
        if index in import_token_indexes:
            continue
        if index > 0 and tokens[index - 1] in {
            ("punctuation", "."),
            ("punctuation", "#"),
        }:
            continue
        if token[1] not in runner_bindings:
            continue
        if (
            index > 0
            and tokens[index - 1][0] == "identifier"
            and tokens[index - 1][1]
            in {"const", "let", "var", "function", "class"}
        ) or (
            index + 1 >= len(tokens)
            or tokens[index + 1]
            not in {("punctuation", "("), ("punctuation", ".")}
        ):
            raise ValidationError(
                f"ambiguous or shadowed test runner binding: {token[1]}"
            )
        cursor = index + 1
        valid_chain = True
        while (
            cursor + 1 < len(tokens)
            and tokens[cursor] == ("punctuation", ".")
            and tokens[cursor + 1][0] == "identifier"
        ):
            modifier = tokens[cursor + 1][1]
            cursor += 2
            if modifier in FORBIDDEN_FINAL_TEST_MODIFIERS:
                raise ValidationError(
                    f"disabled or focused final test case is forbidden: {modifier}"
                )
            if modifier == "each":
                if cursor < len(tokens) and tokens[cursor] == ("punctuation", "("):
                    balanced = skip_balanced_parentheses(tokens, cursor)
                    if balanced is None:
                        valid_chain = False
                        break
                    arguments = tokens[cursor + 1 : balanced - 1]
                    spread_table = any(
                        arguments[offset : offset + 3]
                        == [("punctuation", ".")] * 3
                        for offset in range(max(0, len(arguments) - 2))
                    )
                    if (
                        len(arguments) < 3
                        or arguments[0] != ("punctuation", "[")
                        or arguments[-1] != ("punctuation", "]")
                        or arguments[1:-1] == []
                        or spread_table
                    ):
                        raise ValidationError(
                            "final test.each requires a statically non-empty array table"
                        )
                    cursor = balanced
                elif cursor < len(tokens) and tokens[cursor][0] == "template":
                    raise ValidationError(
                        "final test.each tagged template execution count is not provable"
                    )
                else:
                    valid_chain = False
                break
            if modifier not in ALLOWED_TEST_MODIFIERS:
                valid_chain = False
                break
        if (
            valid_chain
            and cursor < len(tokens)
            and tokens[cursor] == ("punctuation", "(")
            and cursor + 1 < len(tokens)
            and tokens[cursor + 1][0] == "string"
        ):
            names.append(tokens[cursor + 1][1])
    return names


def validate_final_target_state(
    repo_root: Path,
    target_state: dict[str, Any],
) -> tuple[list[str], list[dict[str, str]]]:
    try:
        current_paths = inventory_owned_paths(repo_root, target_state)
    except SourceError as error:
        raise ValidationError(str(error)) from error
    representations = target_state["representations"]
    target_paths = {entry["path"] for entry in representations}
    missing_paths = sorted(path for path in target_paths if not (repo_root / path).is_file())
    if missing_paths:
        raise ValidationError(
            "target representations are missing: " + ", ".join(missing_paths)
        )
    extra_paths = sorted(set(current_paths) - target_paths)
    if extra_paths:
        raise ValidationError(
            "task-owned paths absent from target state remain: " + ", ".join(extra_paths)
        )

    expected_by_path: dict[str, set[tuple[str, str, str]]] = {}
    for entry in representations:
        expected_by_path.setdefault(entry["path"], set()).add(
            representation_identity(entry)
        )
    actual_records: list[dict[str, str]] = []
    for path in sorted(expected_by_path):
        expected = expected_by_path[path]
        locator_kinds = {identity[1] for identity in expected}
        if locator_kinds == {"file"}:
            actual_records.append({"path": path, "locator": "file", "name": ""})
            continue
        try:
            text = (repo_root / path).read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise ValidationError(f"granular representation must be UTF-8: {path}") from error
        actual_entries: list[tuple[str, str, str]] = []
        if "export" in locator_kinds:
            actual_entries.extend(
                (path, "export", name) for name in exported_names(text)
            )
        if "test_case" in locator_kinds:
            actual_entries.extend(
                (path, "test_case", name) for name in literal_test_case_names(text)
            )
        if len(actual_entries) != len(set(actual_entries)):
            raise ValidationError(
                f"granular representation locators must be unique in {path}"
            )
        actual = set(actual_entries)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            detail = []
            if missing:
                detail.append(f"missing={missing}")
            if extra:
                detail.append(f"extra={extra}")
            raise ValidationError(
                f"final representations do not match target state for {path}: "
                + "; ".join(detail)
            )
        actual_records.extend(
            {"path": identity[0], "locator": identity[1], "name": identity[2]}
            for identity in sorted(actual)
        )
    return current_paths, actual_records


def run_checked_git(repo_root: Path, arguments: list[str], label: str) -> str:
    result = run_git(repo_root, arguments)
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValidationError(f"{label} failed: {detail or 'unknown Git error'}")
    return result.stdout.decode("utf-8")


def require_git_visible_paths(repo_root: Path, paths: list[str]) -> None:
    for path in sorted(set(paths)):
        result = run_git(repo_root, ["check-ignore", "-q", "--", path])
        if result.returncode == 0:
            raise ValidationError(
                f"task-owned path must be visible to Git diff inspection: {path}"
            )
        if result.returncode != 1:
            detail = result.stderr.decode("utf-8", errors="replace").strip()
            raise ValidationError(
                f"Git visibility check failed for task-owned path {path}: "
                f"{detail or 'unknown Git error'}"
            )


def changed_paths(repo_root: Path, baseline_head: str) -> list[dict[str, str]]:
    run_checked_git(
        repo_root,
        ["cat-file", "-e", f"{baseline_head}^{{commit}}"],
        "build baseline lookup",
    )
    run_checked_git(
        repo_root,
        ["merge-base", "--is-ancestor", baseline_head, "HEAD"],
        "build baseline ancestry check",
    )
    output = run_checked_git(
        repo_root,
        ["diff", "--name-status", "--find-renames", baseline_head, "--"],
        "build diff inspection",
    )
    changes: list[dict[str, str]] = []
    for line in output.splitlines():
        fields = line.split("\t")
        status = fields[0]
        if status.startswith(("R", "C")) and len(fields) == 3:
            changes.append({"status": "D", "path": fields[1]})
            changes.append({"status": "A", "path": fields[2]})
        elif len(fields) == 2:
            changes.append({"status": status[0], "path": fields[1]})
        else:
            raise ValidationError(f"unsupported Git name-status record: {line}")
    untracked = run_checked_git(
        repo_root,
        ["ls-files", "--others", "--exclude-standard"],
        "untracked file inspection",
    )
    tracked_paths = {entry["path"] for entry in changes}
    changes.extend(
        {"status": "A", "path": path}
        for path in untracked.splitlines()
        if path and path not in tracked_paths
    )
    return sorted(changes, key=lambda entry: (entry["path"], entry["status"]))


def load_receipt(
    repo_root: Path,
    workspace: str,
    expected_receipt_sha256: str,
) -> tuple[dict[str, Any], bytes]:
    receipt_path = canonical_receipt_path(repo_root, workspace)
    receipt_bytes = read_regular_file_bytes(receipt_path)
    if sha256_bytes(receipt_bytes) != expected_receipt_sha256:
        raise ValidationError(
            "Design completion receipt SHA-256 does not match Build Goal evidence"
        )
    try:
        receipt = decode_source_json(receipt_bytes.decode("utf-8"))
    except UnicodeDecodeError as error:
        raise ValidationError("Design completion receipt must be UTF-8 JSON") from error
    if not isinstance(receipt, dict) or receipt.get("schema_version") != 3:
        raise ValidationError("Build rule coverage requires receipt schema_version 3")
    if receipt.get("workspace") != workspace:
        raise ValidationError("Design completion receipt workspace does not match")
    return receipt, receipt_bytes


def validate(
    repo_root: Path,
    workspace: str,
    expected_receipt_sha256: str,
) -> dict[str, Any]:
    repo_root = require_repository_root(repo_root)
    receipt, receipt_bytes = load_receipt(
        repo_root,
        workspace,
        expected_receipt_sha256,
    )
    rule_map_path = require_canonical_worktree_path(
        repo_root,
        repo_root / "docs" / "harness" / "rule-map.json",
        Path("docs/harness/rule-map.json"),
        "rule-map",
    )
    rule_map_bytes = read_regular_file_bytes(rule_map_path)
    if sha256_bytes(rule_map_bytes) != receipt["rule_map"]["sha256"]:
        raise ValidationError("canonical rule-map changed after Design completion")
    try:
        rule_map = decode_source_json(rule_map_bytes.decode("utf-8"))
        rules_by_id = validate_rule_map(rule_map)
        routing = validate_review_routing(rule_map, rules_by_id)
    except (UnicodeDecodeError, RuleMapValidationError, RuleCoverageError) as error:
        raise ValidationError(f"canonical rule-map is invalid: {error}") from error

    selected_rules = [entry["id"] for entry in receipt["selected_rules"]]
    rule_coverage = receipt["rule_coverage"]["value"]
    if receipt["rule_coverage"]["sha256"] != structured_sha256(rule_coverage):
        raise ValidationError("Design receipt rule_coverage hash does not match")
    declared_surfaces = rule_coverage["implementation_surfaces"]
    baseline_head = receipt["build_baseline"]["head"]
    target_state = receipt["target_state"]["value"]
    if receipt["target_state"]["sha256"] != structured_sha256(target_state):
        raise ValidationError("Design receipt target_state hash does not match")
    ownership_scopes = receipt["ownership_scopes"]["value"]
    if receipt["ownership_scopes"]["sha256"] != structured_sha256(ownership_scopes):
        raise ValidationError("Design receipt ownership scope hash does not match")
    if ownership_scopes != target_state["ownership_scopes"]:
        raise ValidationError("Design receipt ownership scopes do not match target state")
    baseline_inventory = receipt["baseline_inventory"]["value"]
    if receipt["baseline_inventory"]["sha256"] != structured_sha256(
        baseline_inventory
    ):
        raise ValidationError("Design receipt baseline inventory hash does not match")
    current_inventory, actual_representations = validate_final_target_state(
        repo_root, target_state
    )
    require_git_visible_paths(
        repo_root,
        [
            *current_inventory,
            *(entry["path"] for entry in target_state["ownership_scopes"]),
            *(entry["path"] for entry in target_state["representations"]),
        ],
    )
    receipt_sha256 = sha256_bytes(receipt_bytes)
    verification_results, verification_bytes = load_verification_results(
        repo_root, workspace, receipt_sha256, target_state
    )
    all_changes = changed_paths(repo_root, baseline_head)
    workflow_paths = {
        receipt["artifacts"][kind][part]["path"]
        for kind in ("requirements", "design")
        for part in ("source", "display")
    } | {
        canonical_receipt_path(repo_root, workspace).relative_to(repo_root).as_posix(),
        canonical_verification_path(repo_root, workspace).relative_to(repo_root).as_posix(),
        canonical_coverage_path(repo_root, workspace).relative_to(repo_root).as_posix(),
    }
    out_of_scope = [
        change["path"]
        for change in all_changes
        if change["path"] not in workflow_paths
        and not any(
            change["path"] == scope["path"]
            or (
                scope["kind"] == "tree"
                and change["path"].startswith(f"{scope['path']}/")
            )
            for scope in target_state["ownership_scopes"]
        )
    ]
    if out_of_scope:
        raise ValidationError(
            "actual Build diff exceeds task-owned scope: "
            + ", ".join(sorted(out_of_scope))
        )
    governed_changes: list[dict[str, Any]] = []
    actual_surfaces: list[str] = []
    actual_path_rules: list[str] = []
    for change in all_changes:
        path = change["path"]
        if not path_is_governed(path, routing):
            continue
        matched = matching_surfaces(path, routing)
        if not matched:
            raise ValidationError(
                f"governed Build path has no review surface: {path}"
            )
        path_rules = rules_for_path(path, rules_by_id)
        governed_changes.append(
            {**change, "surfaces": matched, "path_rules": path_rules}
        )
        actual_surfaces.extend(matched)
        actual_path_rules.extend(path_rules)
    actual_surfaces = list(dict.fromkeys(actual_surfaces))
    undeclared = set(actual_surfaces) - set(declared_surfaces)
    if undeclared:
        raise ValidationError(
            "actual Build diff requires undeclared Design surfaces: "
            f"{', '.join(sorted(undeclared))}"
        )
    try:
        direct_rule_set = set(rules_for_surfaces(actual_surfaces, routing)) | set(
            actual_path_rules
        )
        direct_rules = [
            rule_id for rule_id in rules_by_id if rule_id in direct_rule_set
        ]
        required_rules = expand_rule_closure(
            direct_rules,
            rules_by_id,
        )
    except RuleCoverageError as error:
        raise ValidationError(str(error)) from error
    missing_rules = set(required_rules) - set(selected_rules)
    if missing_rules:
        raise ValidationError(
            "actual Build diff requires rules absent from the Design receipt: "
            f"{', '.join(sorted(missing_rules))}"
        )
    return {
        "schema_version": COVERAGE_SCHEMA_VERSION,
        "kind": "build_rule_coverage",
        "workspace": workspace,
        "receipt_sha256": receipt_sha256,
        "target_state_sha256": receipt["target_state"]["sha256"],
        "build_baseline_head": baseline_head,
        "baseline_inventory": baseline_inventory,
        "final_inventory": current_inventory,
        "representations": actual_representations,
        "verification": {
            "sha256": sha256_bytes(verification_bytes),
            "results": verification_results,
        },
        "changes": governed_changes,
        "implementation_surfaces": actual_surfaces,
        "direct_rules": direct_rules,
        "checked_rules": required_rules,
        "unresolved": [],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--expected-receipt-sha256", required=True)
    args = parser.parse_args()
    try:
        record = validate(
            args.repo_root,
            args.workspace,
            args.expected_receipt_sha256,
        )
        output_path = canonical_coverage_path(args.repo_root, args.workspace)
        serialized = f"{json.dumps(record, ensure_ascii=False, indent=2)}\n"
        write_regular_file_atomically(output_path, serialized)
    except (
        KeyError,
        OSError,
        TypeError,
        UnicodeDecodeError,
        GitBaselineError,
        ValidationError,
    ) as error:
        print(f"build rule coverage: failed: {error}", file=sys.stderr)
        return 1
    print(f"build rule coverage: verified: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

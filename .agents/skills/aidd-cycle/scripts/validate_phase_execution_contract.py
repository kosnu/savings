"""Validate the AIDD phase executor and Goal ownership contract."""

from __future__ import annotations

import argparse
import re
import sys
import tomllib
from pathlib import Path
from typing import Any


CONTRACT_ID = "aidd-phase-execution-v1"
CONTRACT_RELATIVE_PATH = Path(
    ".agents/skills/aidd-cycle/references/phase-execution-contract.toml"
)
PARENT_SKILL_RELATIVE_PATH = Path(".agents/skills/aidd-cycle/SKILL.md")
GOAL_SETTING_RELATIVE_PATH = Path(".agents/skills/goal-setting/SKILL.md")
CODEX_CONFIG_RELATIVE_PATH = Path(".codex/config.toml")
VALIDATOR_RELATIVE_PATH = Path(
    ".agents/skills/aidd-cycle/scripts/validate_phase_execution_contract.py"
)
WORKFLOW_PHASES = ("Requirements", "Design", "Build", "Ship")
DELEGATED_PHASES = ("Requirements", "Design", "Build")
GOAL_TOOLS = ("get_goal", "create_goal", "update_goal")
DELEGATED_RESPONSIBILITIES = ("phase_outputs", "verification_evidence")
FORBIDDEN_RESPONSIBILITIES = (
    "goal_lifecycle",
    "goal_setting",
    "phase_transition",
    "learn",
    "delegation",
)
COMMON_FORBIDDEN_INSTRUCTION_IDENTIFIERS = (
    *GOAL_TOOLS,
    "goal-setting",
)
AGENT_FORBIDDEN_INSTRUCTION_IDENTIFIERS = {
    "aidd-requirements-design": (
        *COMMON_FORBIDDEN_INSTRUCTION_IDENTIFIERS,
        "build",
        "ship",
        "learn",
        "commit",
        "push",
        "pull request",
        "pr",
        "spawn_agent",
        "delegate",
        "delegated",
        "delegation",
        "later phase",
        "next phase",
    ),
    "aidd-build": (
        *COMMON_FORBIDDEN_INSTRUCTION_IDENTIFIERS,
        "ship",
        "learn",
        "commit",
        "push",
        "pull request",
        "pr",
        "spawn_agent",
        "delegate",
        "delegated",
        "delegation",
        "later phase",
        "next phase",
    ),
}
PHASE_KEYS = {
    "name",
    "executor",
    "configuration",
    "delegated",
    "goal_access",
}


class ContractError(ValueError):
    """Raised when an AIDD phase execution representation drifts."""


def _load_toml(path: Path) -> dict[str, Any]:
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise ContractError(f"cannot load TOML {path}: {error}") from error


def _require_exact_keys(
    value: Any, expected: set[str], label: str
) -> None:
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be a table")
    actual = set(value)
    if actual != expected:
        raise ContractError(
            f"{label} keys must be {sorted(expected)}; got {sorted(actual)}"
        )


def _require_sequence(value: Any, expected: tuple[str, ...], label: str) -> None:
    if not isinstance(value, list) or tuple(value) != expected:
        raise ContractError(f"{label} must be {list(expected)}; got {value!r}")


def _contains_identifier(text: str, identifier: str) -> bool:
    pattern = re.compile(
        rf"(?<![A-Za-z0-9_]){re.escape(identifier)}(?![A-Za-z0-9_])",
        re.IGNORECASE,
    )
    return pattern.search(text) is not None


def _validate_contract(contract: dict[str, Any]) -> list[dict[str, Any]]:
    _require_exact_keys(
        contract,
        {
            "id",
            "version",
            "goal_lifecycle",
            "goal_setting",
            "delegation",
            "agent_instructions",
            "agent_instruction_forbidden_identifiers",
            "phases",
        },
        "contract",
    )
    if (
        contract["id"] != CONTRACT_ID
        or type(contract["version"]) is not int
        or contract["version"] != 1
    ):
        raise ContractError(
            f"contract identity must be {CONTRACT_ID!r} at version 1"
        )

    lifecycle = contract["goal_lifecycle"]
    _require_exact_keys(lifecycle, {"owner", "tools"}, "goal_lifecycle")
    if lifecycle["owner"] != "parent":
        raise ContractError("goal_lifecycle.owner must be 'parent'")
    _require_sequence(lifecycle["tools"], GOAL_TOOLS, "goal_lifecycle.tools")

    goal_setting = contract["goal_setting"]
    _require_exact_keys(
        goal_setting, {"owner", "entrypoint"}, "goal_setting"
    )
    if goal_setting != {"owner": "parent", "entrypoint": "goal-setting"}:
        raise ContractError("goal_setting must be owned by the parent")

    delegation = contract["delegation"]
    _require_exact_keys(
        delegation,
        {
            "phases",
            "allowed_responsibilities",
            "forbidden_responsibilities",
        },
        "delegation",
    )
    _require_sequence(delegation["phases"], DELEGATED_PHASES, "delegation.phases")
    _require_sequence(
        delegation["allowed_responsibilities"],
        DELEGATED_RESPONSIBILITIES,
        "delegation.allowed_responsibilities",
    )
    _require_sequence(
        delegation["forbidden_responsibilities"],
        FORBIDDEN_RESPONSIBILITIES,
        "delegation.forbidden_responsibilities",
    )

    phases = contract["phases"]
    if not isinstance(phases, list) or not all(
        isinstance(phase, dict) for phase in phases
    ):
        raise ContractError("phases must be an array of tables")
    if tuple(phase.get("name") for phase in phases) != WORKFLOW_PHASES:
        raise ContractError(f"phase order must be {list(WORKFLOW_PHASES)}")

    for phase in phases:
        name = phase["name"]
        _require_exact_keys(phase, PHASE_KEYS, f"phase {name}")
        for key in ("name", "executor", "configuration", "goal_access"):
            if not isinstance(phase[key], str) or not phase[key]:
                raise ContractError(f"phase {name} {key} must be a string")
        if not isinstance(phase["delegated"], bool):
            raise ContractError(f"phase {name} delegated must be a boolean")
        if name in DELEGATED_PHASES:
            if phase["delegated"] is not True:
                raise ContractError(f"phase {name} must be delegated")
            if phase["goal_access"] != "forbidden":
                raise ContractError(
                    f"phase {name} goal_access must be 'forbidden'"
                )
            if phase["executor"] == "parent agent":
                raise ContractError(f"phase {name} must use a phase agent")
            if not str(phase["configuration"]).startswith(".codex/agents/"):
                raise ContractError(
                    f"phase {name} must name a project agent configuration"
                )
        elif phase != {
            "name": "Ship",
            "executor": "parent agent",
            "configuration": "current selection",
            "delegated": False,
            "goal_access": "owner",
        }:
            raise ContractError("Ship must remain parent-owned and not delegated")

    delegated_agents = {
        phase["executor"] for phase in phases if phase["delegated"]
    }
    instruction_contracts = contract["agent_instructions"]
    _require_exact_keys(
        instruction_contracts,
        delegated_agents,
        "agent_instructions",
    )
    for executor, instructions in instruction_contracts.items():
        if not isinstance(instructions, str) or not instructions.strip():
            raise ContractError(
                f"agent_instructions.{executor} must be a non-empty string"
            )
    forbidden_identifier_contracts = contract[
        "agent_instruction_forbidden_identifiers"
    ]
    _require_exact_keys(
        forbidden_identifier_contracts,
        delegated_agents,
        "agent_instruction_forbidden_identifiers",
    )
    for executor, expected_identifiers in (
        AGENT_FORBIDDEN_INSTRUCTION_IDENTIFIERS.items()
    ):
        _require_sequence(
            forbidden_identifier_contracts[executor],
            expected_identifiers,
            f"agent_instruction_forbidden_identifiers.{executor}",
        )
        instructions = instruction_contracts[executor]
        for identifier in expected_identifiers:
            if _contains_identifier(instructions, identifier):
                raise ContractError(
                    f"canonical instructions for {executor} contain forbidden "
                    f"identifier {identifier}"
                )

    return phases


def _normalize_cell(value: str) -> str:
    return value.strip().strip("`").strip()


def _parse_assignment_table(skill_text: str) -> list[tuple[str, str, str]]:
    heading = "## Phase Execution Assignment"
    if skill_text.count(heading) != 1:
        raise ContractError(f"parent skill must contain one {heading!r} heading")

    section = skill_text.split(heading, maxsplit=1)[1]
    lines = section.splitlines()
    header_index = next(
        (
            index
            for index, line in enumerate(lines)
            if line.strip() == "| Phase | Executor | Configuration |"
        ),
        None,
    )
    if header_index is None:
        raise ContractError("phase assignment table header is missing")

    rows: list[tuple[str, str, str]] = []
    for line in lines[header_index + 2 :]:
        if not line.strip().startswith("|"):
            break
        cells = tuple(
            _normalize_cell(cell) for cell in line.strip().strip("|").split("|")
        )
        if len(cells) != 3:
            raise ContractError(f"invalid phase assignment row: {line}")
        rows.append(cells)
    return rows


def _require_contract_reference(text: str, label: str) -> None:
    normalized = " ".join(text.split())
    if CONTRACT_ID not in normalized:
        raise ContractError(f"{label} must reference contract {CONTRACT_ID}")
    if CONTRACT_RELATIVE_PATH.as_posix() not in normalized:
        raise ContractError(
            f"{label} must reference {CONTRACT_RELATIVE_PATH.as_posix()}"
        )


def _require_validator_command(text: str, label: str) -> None:
    normalized = " ".join(text.split())
    command = f"python3 {VALIDATOR_RELATIVE_PATH.as_posix()}"
    if command not in normalized:
        raise ContractError(f"{label} must run phase contract validator")


def _registration_path(configuration: str) -> str:
    prefix = ".codex/"
    if not configuration.startswith(prefix):
        raise ContractError(
            f"agent configuration must start with {prefix}: {configuration}"
        )
    return f"./{configuration.removeprefix(prefix)}"


def validate_repository_contract(repo_root: Path) -> None:
    """Validate all repository representations against the canonical contract."""

    contract = _load_toml(repo_root / CONTRACT_RELATIVE_PATH)
    phases = _validate_contract(contract)

    parent_skill = (repo_root / PARENT_SKILL_RELATIVE_PATH).read_text(
        encoding="utf-8"
    )
    _require_contract_reference(parent_skill, "parent skill")
    _require_validator_command(parent_skill, "parent skill")
    expected_rows = [
        (phase["name"], phase["executor"], phase["configuration"])
        for phase in phases
    ]
    actual_rows = _parse_assignment_table(parent_skill)
    if actual_rows != expected_rows:
        raise ContractError(
            f"phase assignment table must be {expected_rows}; got {actual_rows}"
        )

    goal_setting_skill = (repo_root / GOAL_SETTING_RELATIVE_PATH).read_text(
        encoding="utf-8"
    )
    _require_contract_reference(goal_setting_skill, "goal-setting skill")
    _require_validator_command(goal_setting_skill, "goal-setting skill")

    project_config = _load_toml(repo_root / CODEX_CONFIG_RELATIVE_PATH)
    registrations = project_config.get("agents")
    if not isinstance(registrations, dict):
        raise ContractError(".codex/config.toml must define [agents] registrations")

    checked_agents: set[str] = set()
    for phase in phases:
        if not phase["delegated"]:
            continue
        executor = phase["executor"]
        registration = registrations.get(executor)
        if not isinstance(registration, dict):
            raise ContractError(f"agent {executor} is not registered")
        expected_config = _registration_path(phase["configuration"])
        if registration.get("config_file") != expected_config:
            raise ContractError(
                f"agent {executor} config_file must be {expected_config!r}"
            )
        if executor in checked_agents:
            continue
        checked_agents.add(executor)

        agent_config = _load_toml(repo_root / phase["configuration"])
        if agent_config.get("name") != executor:
            raise ContractError(f"agent config name must be {executor!r}")
        instructions = agent_config.get("developer_instructions")
        if not isinstance(instructions, str):
            raise ContractError(
                f"agent {executor} must define developer_instructions"
            )
        _require_contract_reference(instructions, f"agent {executor}")
        forbidden_identifiers = contract[
            "agent_instruction_forbidden_identifiers"
        ][executor]
        for identifier in forbidden_identifiers:
            if _contains_identifier(instructions, identifier):
                raise ContractError(
                    f"agent {executor} instructions contain forbidden "
                    f"identifier {identifier}"
                )
        canonical_instructions = contract["agent_instructions"][executor]
        _require_contract_reference(
            canonical_instructions, f"canonical instructions for {executor}"
        )
        if " ".join(instructions.split()) != " ".join(
            canonical_instructions.split()
        ):
            raise ContractError(
                f"agent {executor} instructions must match canonical instructions"
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the AIDD phase execution contract."
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[4],
    )
    args = parser.parse_args()

    try:
        validate_repository_contract(args.repo_root.resolve())
    except (ContractError, OSError) as error:
        print(f"phase execution contract validation failed: {error}", file=sys.stderr)
        return 1

    print(f"phase execution contract valid: {CONTRACT_ID}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

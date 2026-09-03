package phasecontract

import (
	"context"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

var fixturePaths = []string{
	contractRelativePath,
	parentSkillPath,
	goalSettingSkillPath,
	projectConfigPath,
	operationsPath,
	".codex/agents/aidd-requirements-design.toml",
	".codex/agents/aidd-build.toml",
}

func TestRepositoryContractIsValid(t *testing.T) {
	if err := Validate(context.Background(), repositoryRoot(t)); err != nil {
		t.Fatal(err)
	}
}

func TestAIDDControlPlaneContainsNoPythonSources(t *testing.T) {
	root := repositoryRoot(t)
	for _, relativeRoot := range []string{"tools/aidd", ".agents/skills/aidd-cycle", ".agents/skills/goal-setting", ".codex"} {
		err := filepath.WalkDir(filepath.Join(root, filepath.FromSlash(relativeRoot)), func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !entry.IsDir() && strings.EqualFold(filepath.Ext(path), ".py") {
				t.Errorf("AIDD control plane must not contain Python source: %s", path)
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestInstructionLineWrappingDoesNotChangeSemantics(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, ".codex/agents/aidd-build.toml", "prepared by the parent orchestrator.", "prepared by the parent\norchestrator.")
	if err := Validate(context.Background(), root); err != nil {
		t.Fatal(err)
	}
}

func TestForbiddenGoalIdentifiersAreRejected(t *testing.T) {
	additions := map[string]string{
		"Call `get_goal`.":                        "get_goal",
		"Embedded use of create_goal is allowed.": "create_goal",
		"Use update_goal after validation.":       "update_goal",
		"Run goal-setting for the next phase.":    "goal-setting",
	}
	for addition, identifier := range additions {
		t.Run(identifier, func(t *testing.T) {
			root := fixtureRoot(t)
			replaceFixture(t, root, ".codex/agents/aidd-build.toml", "Complete only the active Build Goal", addition+" Complete only the active Build Goal")
			requireContractError(t, Validate(context.Background(), root), "forbidden identifier "+identifier)
		})
	}
}

func TestAssignmentTableDriftIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, parentSkillPath, "| Design | `aidd-requirements-design` |", "| Design | `aidd-build` |")
	requireContractError(t, Validate(context.Background(), root), "phase assignment table")
}

func TestConflictingPhaseResponsibilityIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, ".codex/agents/aidd-build.toml", "Complete only the active Build Goal", "Commit, push, open a PR, and start Ship. Complete only the active Build Goal")
	requireContractError(t, Validate(context.Background(), root), "forbidden identifier ship")
}

func TestCanonicalInstructionsCannotGrantShipResponsibility(t *testing.T) {
	root := fixtureRoot(t)
	for _, path := range []string{contractRelativePath, ".codex/agents/aidd-build.toml"} {
		replaceFixture(t, root, path, "Complete only the active Build Goal", "Commit, push, open a PR, and start Ship. Complete only the active Build Goal")
	}
	requireContractError(t, Validate(context.Background(), root), "canonical instructions for aidd-build contain forbidden identifier ship")
}

func TestAgentRegistrationDriftIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, projectConfigPath, `config_file = "./agents/aidd-build.toml"`, `config_file = "./agents/context-scout.toml"`)
	requireContractError(t, Validate(context.Background(), root), "config_file")
}

func TestAgentNameDriftIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, ".codex/agents/aidd-build.toml", `name = "aidd-build"`, `name = "aidd-build-renamed"`)
	requireContractError(t, Validate(context.Background(), root), "agent config name")
}

func TestParentGoalOwnershipDriftIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, contractRelativePath, `owner = "parent"`, `owner = "phase-agent"`)
	requireContractError(t, Validate(context.Background(), root), "goal_lifecycle.owner")
}

func TestBooleanContractVersionIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, contractRelativePath, "version = 1", "version = true")
	requireContractError(t, Validate(context.Background(), root), "TOML file is invalid")
}

func TestGoalSettingRequiresContractValidator(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, goalSettingSkillPath, validatorCommand, "/tmp/disabled-phase-contract-validator")
	requireContractError(t, Validate(context.Background(), root), "must run the phase contract validator")
}

func TestCycleRequiresCurrentSourceBootstrap(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, parentSkillPath, bootstrapCommands[1], "use-existing-aidd-checker")
	requireContractError(t, Validate(context.Background(), root), "must build the current checker source")
}

func TestShipAssignmentDriftIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, parentSkillPath, "| Ship | parent agent | current selection |", "| Ship | `aidd-build` | `.codex/agents/aidd-build.toml` |")
	requireContractError(t, Validate(context.Background(), root), "phase assignment table")
}

func TestUnknownExecutorIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, contractRelativePath, `executor = "aidd-build"`, `executor = "aidd-unknown"`)
	requireContractError(t, Validate(context.Background(), root), "fixed executor and configuration map")
}

func TestConfigurationTraversalIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, contractRelativePath, `configuration = ".codex/agents/aidd-build.toml"`, `configuration = ".codex/agents/../../outside.toml"`)
	requireContractError(t, Validate(context.Background(), root), "fixed executor and configuration map")
}

func TestAgentConfigSymlinkIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	configPath := filepath.Join(root, ".codex", "agents", "aidd-build.toml")
	targetPath := filepath.Join(root, ".codex", "agents", "aidd-build-real.toml")
	if err := os.Rename(configPath, targetPath); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("aidd-build-real.toml", configPath); err != nil {
		t.Fatal(err)
	}
	requireContractError(t, Validate(context.Background(), root), "must not traverse symlinks")
}

func TestAgentConfigUnknownFieldIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, ".codex/agents/aidd-build.toml", `model_reasoning_effort = "max"`, "model_reasoning_effort = \"max\"\nunknown_capability = true")
	requireContractError(t, Validate(context.Background(), root), "TOML file is invalid")
}

func TestAgentRegistrationUnknownFieldIsRejected(t *testing.T) {
	root := fixtureRoot(t)
	replaceFixture(t, root, projectConfigPath, `config_file = "./agents/aidd-build.toml"`, "config_file = \"./agents/aidd-build.toml\"\nunknown_capability = true")
	requireContractError(t, Validate(context.Background(), root), "unknown or missing fields")
}

func TestOperationsDocumentIsRequired(t *testing.T) {
	root := fixtureRoot(t)
	if err := os.Remove(filepath.Join(root, filepath.FromSlash(operationsPath))); err != nil {
		t.Fatal(err)
	}
	requireContractError(t, Validate(context.Background(), root), operationsPath)
}

func TestPhaseAgentsDeclareTargetStateContract(t *testing.T) {
	root := repositoryRoot(t)
	for _, path := range []string{".codex/agents/aidd-requirements-design.toml", ".codex/agents/aidd-build.toml"} {
		content := readFixture(t, root, path)
		for _, required := range []string{"schema v4", "target_state", "ownership scopes", "verification case", "parent orchestrator", "Do not create, complete, block, or otherwise update a Goal"} {
			if !strings.Contains(content, required) {
				t.Fatalf("%s must contain %q", path, required)
			}
		}
		for _, forbidden := range []string{"call get_goal", "terminal Goal update"} {
			if strings.Contains(content, forbidden) {
				t.Fatalf("%s must not contain %q", path, forbidden)
			}
		}
	}
	design := readFixture(t, root, ".codex/agents/aidd-requirements-design.toml")
	build := readFixture(t, root, ".codex/agents/aidd-build.toml")
	for _, required := range []string{"substantive descriptions", "verification_profile_id", "hash-fixed profile catalog"} {
		if !strings.Contains(design, required) {
			t.Fatalf("design agent must contain %q", required)
		}
	}
	for _, required := range []string{"receipt-fixed product behavior descriptions", "receipt-fixed verification profile catalog"} {
		if !strings.Contains(build, required) {
			t.Fatalf("build agent must contain %q", required)
		}
	}
}

func fixtureRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	command := exec.Command("git", "init", "--quiet", root)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git init: %v: %s", err, output)
	}
	sourceRoot := repositoryRoot(t)
	for _, relative := range fixturePaths {
		destination := filepath.Join(root, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(destination, []byte(readFixture(t, sourceRoot, relative)), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", "..", "..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return root
}

func readFixture(t *testing.T, root, relative string) string {
	t.Helper()
	content, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(relative)))
	if err != nil {
		t.Fatal(err)
	}
	return string(content)
}

func replaceFixture(t *testing.T, root, relative, old, replacement string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	content := readFixture(t, root, relative)
	if !strings.Contains(content, old) {
		t.Fatalf("%s does not contain %q", relative, old)
	}
	if err := os.WriteFile(path, []byte(strings.Replace(content, old, replacement, 1)), 0o644); err != nil {
		t.Fatal(err)
	}
}

func requireContractError(t *testing.T, err error, contains string) {
	t.Helper()
	if err == nil || !strings.Contains(err.Error(), contains) {
		t.Fatalf("expected error containing %q, got %v", contains, err)
	}
}

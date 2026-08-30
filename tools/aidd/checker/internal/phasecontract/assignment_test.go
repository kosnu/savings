package phasecontract

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
)

func TestPrepareAndValidatePhaseAssignment(t *testing.T) {
	root := fixtureRoot(t)
	draft := validAssignment(root)
	content, err := canonical.Pretty(draft)
	if err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(t.TempDir(), "draft.json")
	output := filepath.Join(t.TempDir(), "assignment.json")
	if err := os.WriteFile(source, content, 0o600); err != nil {
		t.Fatal(err)
	}
	digest, err := PrepareAssignment(context.Background(), root, source, output)
	if err != nil {
		t.Fatal(err)
	}
	validated, err := ValidateAssignment(context.Background(), root, output, digest)
	if err != nil {
		t.Fatal(err)
	}
	if validated != digest {
		t.Fatalf("validated digest = %q, want %q", validated, digest)
	}
	info, err := os.Stat(output)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("assignment mode = %o, want 600", info.Mode().Perm())
	}
}

func TestPhaseAssignmentRejectsExecutorDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	value.Executor = "aidd-build"
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_EXECUTOR")
}

func TestPhaseAssignmentRejectsBoundaryOverlap(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	value.Boundary.Write = append(value.Boundary.Write, value.Boundary.ReadOnly[0])
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_BOUNDARY")
}

func TestPhaseAssignmentRejectsAncestorBoundaryOverlap(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	value.Boundary.ReadOnly = []string{"docs"}
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_BOUNDARY")
}

func TestPhaseAssignmentRejectsBranchDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	value.Branch = "wrong-branch"
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_BRANCH")
}

func TestPhaseAssignmentRejectsInputDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	value.Inputs[0].SHA256 = strings.Repeat("c", 64)
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_INPUT_DRIFT")
}

func TestPhaseAssignmentRejectsDuplicateInputPath(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	duplicate := value.Inputs[0]
	duplicate.ID = "same-path"
	value.Inputs = append(value.Inputs, duplicate)
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_DUPLICATE")
}

func TestPhaseAssignmentRejectsByteDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	content, err := canonical.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "assignment.json")
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	_, err = ValidateAssignment(context.Background(), root, path, strings.Repeat("f", 64))
	if err == nil || !strings.Contains(err.Error(), "AIDD_PHASE_ASSIGNMENT_DRIFT") {
		t.Fatalf("expected assignment drift, got %v", err)
	}
}

func TestPhaseAssignmentRejectsModeDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	content, err := canonical.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "assignment.json")
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
	_, err = ValidateAssignment(context.Background(), root, path, canonical.HashBytes(content))
	if err == nil || !strings.Contains(err.Error(), "AIDD_PHASE_ASSIGNMENT_MODE") {
		t.Fatalf("expected assignment mode drift, got %v", err)
	}
}

func TestPhaseAssignmentRequiresParentValidatedHash(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(root)
	content, err := canonical.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "assignment.json")
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	_, err = ValidateAssignment(context.Background(), root, path, "")
	if err == nil || !strings.Contains(err.Error(), "AIDD_PHASE_ASSIGNMENT_HASH") {
		t.Fatalf("expected required assignment hash, got %v", err)
	}
}

func validAssignment(root string) PhaseAssignment {
	canonicalRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		panic(err)
	}
	branchOutput, err := exec.Command("git", "-C", canonicalRoot, "symbolic-ref", "--quiet", "--short", "HEAD").Output()
	if err != nil {
		panic(err)
	}
	inputContent, err := os.ReadFile(filepath.Join(canonicalRoot, filepath.FromSlash(contractRelativePath)))
	if err != nil {
		panic(err)
	}
	return PhaseAssignment{
		SchemaVersion:         AssignmentSchemaVersion,
		Kind:                  AssignmentKind,
		ContractID:            ID,
		RepositoryRoot:        canonicalRoot,
		Branch:                strings.TrimSpace(string(branchOutput)),
		Phase:                 "Requirements",
		Executor:              "aidd-requirements-design",
		Configuration:         ".codex/agents/aidd-requirements-design.toml",
		CycleIdentity:         "owner/repository#1:workspace",
		GoalIdentity:          strings.Repeat("a", 64),
		ContextPacketIdentity: strings.Repeat("b", 64),
		Inputs:                []AssignmentInput{{ID: "phase-contract", Path: contractRelativePath, SHA256: canonical.HashBytes(inputContent)}},
		Boundary:              AssignmentBoundary{ReadOnly: []string{contractRelativePath}, Write: []string{"docs/ai-driven-development/workspaces/example"}},
		Verification:          []string{"validate Requirements artifact"},
		StopConditions:        []string{"stop on assignment drift"},
	}
}

func requireAssignmentError(t *testing.T, root string, value PhaseAssignment, code string) {
	t.Helper()
	content, err := canonical.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "assignment.json")
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	_, err = ValidateAssignment(context.Background(), root, path, canonical.HashBytes(content))
	if err == nil || !strings.Contains(err.Error(), code) {
		t.Fatalf("expected %s, got %v", code, err)
	}
}

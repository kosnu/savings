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
	draft := validAssignment(t, root)
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

func TestPhaseAssignmentConsumerReadsParentVerifiedDocuments(t *testing.T) {
	root := fixtureRoot(t)
	draft := validAssignment(t, root)
	content, err := canonical.Pretty(draft)
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	source := filepath.Join(directory, "draft.json")
	output := filepath.Join(directory, "assignment.json")
	if err := os.WriteFile(source, content, 0o600); err != nil {
		t.Fatal(err)
	}
	digest, err := PrepareAssignment(context.Background(), root, source, output)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ValidateAssignment(context.Background(), root, output, digest); err != nil {
		t.Fatalf("parent validation: %v", err)
	}
	if _, err := ValidateAssignment(context.Background(), root, output, digest); err != nil {
		t.Fatalf("phase consumer validation: %v", err)
	}
	assignmentBytes, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	var consumed PhaseAssignment
	if err := canonical.Decode(assignmentBytes, AssignmentKind, &consumed); err != nil {
		t.Fatal(err)
	}
	for label, document := range map[string]AssignmentDocument{
		"Goal":           consumed.GoalDocument,
		"Context Packet": consumed.ContextPacketDocument,
	} {
		read, err := os.ReadFile(document.Path)
		if err != nil {
			t.Fatalf("consumer cannot read %s: %v", label, err)
		}
		if digest := canonical.HashBytes(read); digest != document.SHA256 {
			t.Fatalf("consumer %s digest = %q, want %q", label, digest, document.SHA256)
		}
	}
}

func TestPhaseAssignmentRejectsExecutorDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	value.Executor = "aidd-build"
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_EXECUTOR")
}

func TestPhaseAssignmentRejectsBoundaryOverlap(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	value.Boundary.Write = append(value.Boundary.Write, value.Boundary.ReadOnly[0])
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_BOUNDARY")
}

func TestPhaseAssignmentRejectsAncestorBoundaryOverlap(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	value.Boundary.ReadOnly = []string{"docs"}
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_BOUNDARY")
}

func TestPhaseAssignmentRejectsBranchDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	value.Branch = "wrong-branch"
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_BRANCH")
}

func TestPhaseAssignmentRejectsInputDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	value.Inputs[0].SHA256 = strings.Repeat("c", 64)
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_INPUT_DRIFT")
}

func TestPhaseAssignmentRejectsDuplicateInputPath(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	duplicate := value.Inputs[0]
	duplicate.ID = "same-path"
	value.Inputs = append(value.Inputs, duplicate)
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_DUPLICATE")
}

func TestPhaseAssignmentRejectsGoalDocumentDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	if err := os.WriteFile(value.GoalDocument.Path, []byte(`{"kind":"different_goal"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_DOCUMENT_DRIFT")
}

func TestPhaseAssignmentRejectsRepositoryDocument(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
	value.GoalDocument = AssignmentDocument{
		Path:   filepath.Join(root, filepath.FromSlash(contractRelativePath)),
		SHA256: value.Inputs[0].SHA256,
	}
	requireAssignmentError(t, root, value, "AIDD_PHASE_ASSIGNMENT_DOCUMENT")
}

func TestPhaseAssignmentRejectsByteDrift(t *testing.T) {
	root := fixtureRoot(t)
	value := validAssignment(t, root)
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
	value := validAssignment(t, root)
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
	value := validAssignment(t, root)
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

func validAssignment(t *testing.T, root string) PhaseAssignment {
	t.Helper()
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
	documentDirectory := t.TempDir()
	goalContent := []byte(`{"kind":"goal","objective":"fixture"}`)
	goalPath := filepath.Join(documentDirectory, "goal.json")
	if err := os.WriteFile(goalPath, goalContent, 0o600); err != nil {
		t.Fatal(err)
	}
	contextPacketContent := []byte("# Context Packet\n\nfixture\n")
	contextPacketPath := filepath.Join(documentDirectory, "context-packet.md")
	if err := os.WriteFile(contextPacketPath, contextPacketContent, 0o600); err != nil {
		t.Fatal(err)
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
		GoalDocument:          AssignmentDocument{Path: goalPath, SHA256: canonical.HashBytes(goalContent)},
		ContextPacketDocument: AssignmentDocument{Path: contextPacketPath, SHA256: canonical.HashBytes(contextPacketContent)},
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

package phasecontract

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

const (
	AssignmentKind          = "phase_assignment"
	AssignmentSchemaVersion = 2
)

type PhaseAssignment struct {
	SchemaVersion         int                `json:"schema_version"`
	Kind                  string             `json:"kind"`
	ContractID            string             `json:"contract_id"`
	RepositoryRoot        string             `json:"repository_root"`
	Branch                string             `json:"branch"`
	Phase                 string             `json:"phase"`
	Executor              string             `json:"executor"`
	Configuration         string             `json:"configuration"`
	CycleIdentity         string             `json:"cycle_identity"`
	GoalDocument          AssignmentDocument `json:"goal_document"`
	ContextPacketDocument AssignmentDocument `json:"context_packet_document"`
	Inputs                []AssignmentInput  `json:"inputs"`
	Boundary              AssignmentBoundary `json:"boundary"`
	Verification          []string           `json:"verification"`
	StopConditions        []string           `json:"stop_conditions"`
}

type AssignmentDocument struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type AssignmentInput struct {
	ID     string `json:"id"`
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type AssignmentBoundary struct {
	ReadOnly []string `json:"read_only"`
	Write    []string `json:"write"`
}

func PrepareAssignment(ctx context.Context, repoRoot, sourcePath, outputPath string) (string, error) {
	value, _, err := loadAndValidateAssignment(ctx, repoRoot, sourcePath, false)
	if err != nil {
		return "", err
	}
	encoded, err := canonical.Marshal(value)
	if err != nil {
		return "", diagnostic.New("AIDD_PHASE_ASSIGNMENT_ENCODE", outputPath, AssignmentKind, "phase assignment cannot be encoded canonically", nil, err.Error())
	}
	if err := writeAssignmentAtomically(outputPath, encoded); err != nil {
		return "", err
	}
	return canonical.HashBytes(encoded), nil
}

func ValidateAssignment(ctx context.Context, repoRoot, documentPath, expectedSHA256 string) (string, error) {
	if !validSHA256(expectedSHA256) {
		return "", diagnostic.New("AIDD_PHASE_ASSIGNMENT_HASH", "expected_sha256", AssignmentKind, "expected phase assignment SHA-256 is invalid", "64 lowercase hexadecimal characters", expectedSHA256)
	}
	_, content, err := loadAndValidateAssignment(ctx, repoRoot, documentPath, true)
	if err != nil {
		return "", err
	}
	digest := canonical.HashBytes(content)
	if digest != expectedSHA256 {
		return "", diagnostic.New("AIDD_PHASE_ASSIGNMENT_DRIFT", documentPath, AssignmentKind, "phase assignment bytes do not match the parent-validated identity", expectedSHA256, digest)
	}
	return digest, nil
}

func loadAndValidateAssignment(ctx context.Context, repoRoot, documentPath string, requireCanonical bool) (*PhaseAssignment, []byte, error) {
	info, err := os.Lstat(documentPath)
	if err != nil {
		return nil, nil, diagnostic.New("AIDD_PHASE_ASSIGNMENT_FILE", documentPath, AssignmentKind, "phase assignment cannot be read", "regular non-symlink file", err.Error())
	}
	if !info.Mode().IsRegular() {
		return nil, nil, diagnostic.New("AIDD_PHASE_ASSIGNMENT_FILE", documentPath, AssignmentKind, "phase assignment must be a regular non-symlink file", "regular file", info.Mode().String())
	}
	if requireCanonical && info.Mode().Perm() != repository.CanonicalOutputMode {
		return nil, nil, diagnostic.New("AIDD_PHASE_ASSIGNMENT_MODE", documentPath, AssignmentKind, "phase assignment permission mode is not canonical", repository.CanonicalOutputModeString, fmt.Sprintf("%04o", info.Mode().Perm()))
	}
	content, err := os.ReadFile(documentPath)
	if err != nil {
		return nil, nil, diagnostic.New("AIDD_PHASE_ASSIGNMENT_FILE", documentPath, AssignmentKind, "phase assignment cannot be read", "readable file", err.Error())
	}
	var value PhaseAssignment
	if err := canonical.Decode(content, AssignmentKind, &value); err != nil {
		return nil, nil, err
	}
	if requireCanonical {
		encoded, err := canonical.Marshal(value)
		if err != nil {
			return nil, nil, err
		}
		if !bytes.Equal(content, encoded) {
			return nil, nil, diagnostic.New("AIDD_PHASE_ASSIGNMENT_CANONICAL", documentPath, AssignmentKind, "phase assignment bytes are not canonical", string(encoded), string(content))
		}
	}
	snapshot, err := repository.Open(ctx, repoRoot)
	if err != nil {
		return nil, nil, err
	}
	defer snapshot.Close()
	contractValue, err := loadContract(snapshot, contractRelativePath)
	if err != nil {
		return nil, nil, err
	}
	if err := validateAssignmentValue(ctx, &value, snapshot, contractValue); err != nil {
		return nil, nil, err
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return nil, nil, err
	}
	return &value, content, nil
}

func validateAssignmentValue(ctx context.Context, value *PhaseAssignment, snapshot *repository.Snapshot, contractValue *contract) error {
	if value.SchemaVersion != AssignmentSchemaVersion || value.Kind != AssignmentKind || value.ContractID != ID {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_IDENTITY", "$", AssignmentKind, "phase assignment identity is invalid", map[string]any{"schema_version": AssignmentSchemaVersion, "kind": AssignmentKind, "contract_id": ID}, map[string]any{"schema_version": value.SchemaVersion, "kind": value.Kind, "contract_id": value.ContractID})
	}
	if filepath.Clean(value.RepositoryRoot) != filepath.Clean(snapshot.Root) {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_REPOSITORY", "repository_root", AssignmentKind, "phase assignment repository does not match the canonical repository", snapshot.Root, value.RepositoryRoot)
	}
	branch, err := repository.CurrentBranch(ctx, snapshot.Root)
	if err != nil {
		return err
	}
	if value.Branch != branch {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_BRANCH", "branch", AssignmentKind, "phase assignment branch does not match the current worktree", branch, value.Branch)
	}
	expected, exists := delegatedPhase(contractValue.Phases, value.Phase)
	if !exists {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_PHASE", "phase", AssignmentKind, "phase assignment must select a delegated phase", delegatedPhases, value.Phase)
	}
	if value.Executor != expected.Executor || value.Configuration != expected.Configuration {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_EXECUTOR", "executor", AssignmentKind, "phase assignment executor does not match the canonical phase contract", map[string]string{"executor": expected.Executor, "configuration": expected.Configuration}, map[string]string{"executor": value.Executor, "configuration": value.Configuration})
	}
	for path, text := range map[string]string{
		"branch": value.Branch, "cycle_identity": value.CycleIdentity,
	} {
		if strings.TrimSpace(text) == "" {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_REQUIRED", path, AssignmentKind, "phase assignment field must be non-empty", "non-empty string", text)
		}
	}
	if err := validateAssignmentDocument(snapshot.Root, "goal_document", value.GoalDocument); err != nil {
		return err
	}
	if err := validateAssignmentDocument(snapshot.Root, "context_packet_document", value.ContextPacketDocument); err != nil {
		return err
	}
	if len(value.Inputs) == 0 {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_INPUT", "inputs", AssignmentKind, "phase assignment must identify at least one input artifact", "non-empty inputs", value.Inputs)
	}
	seenInputs := map[string]struct{}{}
	seenInputPaths := map[string]struct{}{}
	for index, input := range value.Inputs {
		path := "inputs[" + strconv.Itoa(index) + "]"
		if strings.TrimSpace(input.ID) == "" || !validSHA256(input.SHA256) {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_INPUT", path, AssignmentKind, "input artifact identity is invalid", "non-empty id and SHA-256", input)
		}
		if _, err := pathcontract.ValidateRelativePath(input.Path); err != nil {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_INPUT", path+".path", AssignmentKind, "input artifact path is invalid", "canonical repository-relative path", err.Error())
		}
		content, err := snapshot.Read(input.Path)
		if err != nil {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_INPUT", path+".path", AssignmentKind, "input artifact cannot be read from the canonical repository", "readable regular file", err.Error())
		}
		if digest := canonical.HashBytes(content); digest != input.SHA256 {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_INPUT_DRIFT", path+".sha256", AssignmentKind, "input artifact bytes do not match the assigned identity", input.SHA256, digest)
		}
		if _, duplicate := seenInputs[input.ID]; duplicate {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DUPLICATE", path+".id", AssignmentKind, "input artifact id is duplicated", "unique id", input.ID)
		}
		if _, duplicate := seenInputPaths[input.Path]; duplicate {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DUPLICATE", path+".path", AssignmentKind, "input artifact path is duplicated", "unique path", input.Path)
		}
		seenInputs[input.ID] = struct{}{}
		seenInputPaths[input.Path] = struct{}{}
	}
	if err := validateBoundary(value.Boundary); err != nil {
		return err
	}
	if err := validateNonEmptyUnique(value.Verification, "verification"); err != nil {
		return err
	}
	if err := validateNonEmptyUnique(value.StopConditions, "stop_conditions"); err != nil {
		return err
	}
	return nil
}

func validateAssignmentDocument(repoRoot, field string, document AssignmentDocument) error {
	if !filepath.IsAbs(document.Path) || filepath.Clean(document.Path) != document.Path {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DOCUMENT", field+".path", AssignmentKind, "assigned document path must be canonical and absolute", "canonical absolute path outside the repository", document.Path)
	}
	resolved, err := filepath.EvalSymlinks(document.Path)
	if err != nil {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DOCUMENT", field+".path", AssignmentKind, "assigned document path cannot be resolved", "existing regular non-symlink file outside the repository", err.Error())
	}
	relative, err := filepath.Rel(repoRoot, resolved)
	if err != nil || relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))) {
		actual := document.Path
		if err != nil {
			actual = err.Error()
		}
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DOCUMENT", field+".path", AssignmentKind, "assigned document must be stored outside the repository", "canonical absolute path outside the repository", actual)
	}
	if !validSHA256(document.SHA256) {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DOCUMENT", field+".sha256", AssignmentKind, "assigned document identity must be a SHA-256 value", "64 lowercase hexadecimal characters", document.SHA256)
	}
	content, err := repository.ReadExternal(document.Path)
	if err != nil {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DOCUMENT", field+".path", AssignmentKind, "assigned document cannot be read as a stable external file", "readable regular non-symlink file", err.Error())
	}
	if digest := canonical.HashBytes(content); digest != document.SHA256 {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DOCUMENT_DRIFT", field+".sha256", AssignmentKind, "assigned document bytes do not match the parent-provided identity", document.SHA256, digest)
	}
	return nil
}

func validateBoundary(boundary AssignmentBoundary) error {
	if len(boundary.ReadOnly) == 0 || len(boundary.Write) == 0 {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_BOUNDARY", "boundary", AssignmentKind, "phase assignment must define read-only and write boundaries", "non-empty read_only and write arrays", boundary)
	}
	seen := map[string]string{}
	groups := []struct {
		label string
		paths []string
	}{{label: "read_only", paths: boundary.ReadOnly}, {label: "write", paths: boundary.Write}}
	for _, group := range groups {
		label, paths := group.label, group.paths
		for index, path := range paths {
			if _, err := pathcontract.ValidateRelativePath(path); err != nil {
				return diagnostic.New("AIDD_PHASE_ASSIGNMENT_BOUNDARY", "boundary."+label+"["+strconv.Itoa(index)+"]", AssignmentKind, "phase boundary path is invalid", "canonical repository-relative path", err.Error())
			}
			for existing, owner := range seen {
				if pathsOverlap(existing, path) {
					return diagnostic.New("AIDD_PHASE_ASSIGNMENT_BOUNDARY", "boundary."+label, AssignmentKind, "phase boundary paths are duplicated or overlap", "non-overlapping boundary paths", map[string]string{"path": path, "existing_path": existing, "existing_owner": owner, "duplicate_owner": label})
				}
			}
			seen[path] = label
		}
	}
	return nil
}

func pathsOverlap(left, right string) bool {
	return left == right || strings.HasPrefix(left, right+"/") || strings.HasPrefix(right, left+"/")
}

func validateNonEmptyUnique(values []string, path string) error {
	if len(values) == 0 {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_REQUIRED", path, AssignmentKind, "phase assignment list must be non-empty", "non-empty array", values)
	}
	seen := map[string]struct{}{}
	for index, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_REQUIRED", path+"["+strconv.Itoa(index)+"]", AssignmentKind, "phase assignment list entry must be non-empty", "non-empty string", value)
		}
		if _, duplicate := seen[trimmed]; duplicate {
			return diagnostic.New("AIDD_PHASE_ASSIGNMENT_DUPLICATE", path+"["+strconv.Itoa(index)+"]", AssignmentKind, "phase assignment list entry is duplicated", "unique entry", value)
		}
		seen[trimmed] = struct{}{}
	}
	return nil
}

func delegatedPhase(phases []phase, name string) (phase, bool) {
	for _, item := range phases {
		if item.Name == name && item.Delegated {
			return item, true
		}
	}
	return phase{}, false
}

func validSHA256(value string) bool {
	if len(value) != 64 || strings.ToLower(value) != value {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func writeAssignmentAtomically(outputPath string, content []byte) error {
	directory := filepath.Dir(outputPath)
	temporary, err := os.CreateTemp(directory, ".aidd-phase-assignment-*")
	if err != nil {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_WRITE", outputPath, AssignmentKind, "phase assignment output cannot be created", "writable output directory", err.Error())
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return err
	}
	if _, err := temporary.Write(content); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, outputPath); err != nil {
		return diagnostic.New("AIDD_PHASE_ASSIGNMENT_WRITE", outputPath, AssignmentKind, "phase assignment output cannot be replaced atomically", "atomic rename", err.Error())
	}
	return nil
}

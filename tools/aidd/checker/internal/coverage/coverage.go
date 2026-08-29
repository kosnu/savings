package coverage

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/evidence"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

type PathRecord struct {
	Path     string   `json:"path"`
	Status   string   `json:"status"`
	Surfaces []string `json:"surfaces"`
	Rules    []string `json:"rules"`
}

type Record struct {
	SchemaVersion        int            `json:"schema_version"`
	Kind                 string         `json:"kind"`
	Workspace            string         `json:"workspace"`
	ReceiptSHA256        string         `json:"receipt_sha256"`
	TargetStateSHA256    string         `json:"target_state_sha256"`
	FinalStateSHA256     string         `json:"final_state_sha256"`
	VerificationEvidence model.PathHash `json:"verification_evidence"`
	BaselineInventory    []string       `json:"baseline_inventory"`
	FinalInventory       []string       `json:"final_inventory"`
	ChangedPaths         []PathRecord   `json:"changed_paths"`
}

func Path(workspace string) (string, error) {
	return repository.WorkspacePath(workspace, ".aidd/build-rule-coverage.json")
}

func generatedArtifactPaths(workspace string) (string, string, string, error) {
	verificationPath, err := evidence.Path(workspace)
	if err != nil {
		return "", "", "", err
	}
	coveragePath, err := Path(workspace)
	if err != nil {
		return "", "", "", err
	}
	receiptPath, err := receipt.Path(workspace)
	if err != nil {
		return "", "", "", err
	}
	return verificationPath, coveragePath, receiptPath, nil
}

func ValidateAndBuild(ctx context.Context, snapshot *repository.Snapshot, loaded *receipt.Loaded) (*Record, error) {
	if err := receipt.AssertBuildHead(ctx, snapshot, loaded.Value.BuildBaseline.Head); err != nil {
		return nil, err
	}
	_, evidenceBytes, err := evidence.LoadAndValidate(snapshot, loaded)
	if err != nil {
		return nil, err
	}
	finalInventory, err := state.ValidateFinal(snapshot, &loaded.Value.TargetState.Value)
	if err != nil {
		return nil, err
	}
	loadedRules, err := rules.Load(snapshot, loaded.Value.RuleMap.Path)
	if err != nil {
		return nil, err
	}
	if err := validatePinnedInputs(snapshot, loaded, loadedRules); err != nil {
		return nil, err
	}
	changed, err := changedPaths(ctx, snapshot, loaded.Value.BuildBaseline.Head, loaded.Value.UntrackedBaseline.Value)
	if err != nil {
		return nil, err
	}
	verificationPath, coveragePath, receiptPath, err := generatedArtifactPaths(loaded.Value.Workspace)
	if err != nil {
		return nil, err
	}
	excluded := map[string]bool{receiptPath: true, verificationPath: true, coveragePath: true}
	for _, pair := range []model.ArtifactPair{loaded.Value.Artifacts.Requirements, loaded.Value.Artifacts.Design} {
		excluded[pair.Source.Path] = true
		excluded[pair.Display.Path] = true
	}
	selectedRules := map[string]struct{}{}
	for _, record := range loaded.Value.SelectedRules {
		selectedRules[record.ID] = struct{}{}
	}
	declaredSurfaces := map[string]struct{}{}
	for _, surface := range loaded.Value.RuleCoverage.Value.ImplementationSurfaces {
		declaredSurfaces[surface] = struct{}{}
	}
	pathRecords := []PathRecord{}
	for _, change := range changed {
		if excluded[change.Path] {
			continue
		}
		if !insideScopes(change.Path, loaded.Value.OwnershipScopes.Value) {
			return nil, diagnostic.New("AIDD_BUILD_SCOPE", change.Path, "build_rule_coverage", "actual Build diff changed a path outside task ownership", loaded.Value.OwnershipScopes.Value, change.Path)
		}
		surfaces, requiredRules, resolveErr := rules.ResolvePath(loadedRules, change.Path)
		if resolveErr != nil {
			return nil, resolveErr
		}
		for _, surface := range surfaces {
			if _, ok := declaredSurfaces[surface]; !ok {
				return nil, diagnostic.New("AIDD_BUILD_SURFACE", change.Path, "build_rule_coverage", "actual Build diff requires a surface absent from Design receipt", rules.Sorted(declaredSurfaces), surface)
			}
		}
		for _, ruleID := range requiredRules {
			if _, ok := selectedRules[ruleID]; !ok {
				return nil, diagnostic.New("AIDD_BUILD_RULE", change.Path, "build_rule_coverage", "actual Build diff requires a rule absent from Design receipt", rules.Sorted(selectedRules), ruleID)
			}
		}
		pathRecords = append(pathRecords, PathRecord{Path: change.Path, Status: change.Status, Surfaces: surfaces, Rules: requiredRules})
	}
	targetHash, err := canonical.Hash(loaded.Value.TargetState.Value)
	if err != nil {
		return nil, err
	}
	finalHash, err := state.FinalHash(snapshot, &loaded.Value.TargetState.Value)
	if err != nil {
		return nil, err
	}
	record := &Record{
		SchemaVersion:        model.CurrentSchemaVersion,
		Kind:                 "build_rule_coverage",
		Workspace:            loaded.Value.Workspace,
		ReceiptSHA256:        loaded.SHA256,
		TargetStateSHA256:    targetHash,
		FinalStateSHA256:     finalHash,
		VerificationEvidence: model.PathHash{Path: verificationPath, SHA256: canonical.HashBytes(evidenceBytes)},
		BaselineInventory:    loaded.Value.BaselineInventory.Value,
		FinalInventory:       finalInventory,
		ChangedPaths:         pathRecords,
	}
	return record, nil
}

func validatePinnedInputs(snapshot *repository.Snapshot, loaded *receipt.Loaded, loadedRules *rules.Loaded) error {
	expectedArtifactPaths := map[string]string{}
	for _, item := range []struct {
		label    string
		filename string
	}{
		{label: "requirements.source", filename: "requirements.json"},
		{label: "requirements.display", filename: "requirements.md"},
		{label: "design.source", filename: "design-doc.json"},
		{label: "design.display", filename: "design-doc.md"},
	} {
		path, err := repository.WorkspacePath(loaded.Value.Workspace, item.filename)
		if err != nil {
			return err
		}
		expectedArtifactPaths[item.label] = path
	}
	records := []struct {
		label  string
		record model.PathHash
	}{
		{label: "requirements.source", record: loaded.Value.Artifacts.Requirements.Source},
		{label: "requirements.display", record: loaded.Value.Artifacts.Requirements.Display},
		{label: "design.source", record: loaded.Value.Artifacts.Design.Source},
		{label: "design.display", record: loaded.Value.Artifacts.Design.Display},
	}
	for _, item := range records {
		expectedPath := expectedArtifactPaths[item.label]
		if item.record.Path != expectedPath {
			return diagnostic.New("AIDD_ARTIFACT_PATH", item.label+".path", "build_rule_coverage", "receipt artifact path is not canonical", expectedPath, item.record.Path)
		}
		content, err := snapshot.Read(item.record.Path)
		if err != nil {
			return err
		}
		if currentHash := canonical.HashBytes(content); currentHash != item.record.SHA256 {
			return diagnostic.New("AIDD_ARTIFACT_DRIFT", item.record.Path, "build_rule_coverage", "receipt-pinned artifact changed after Design completion", item.record.SHA256, currentHash)
		}
	}
	if loaded.Value.RuleMap.Path != "docs/harness/rule-map.json" || loaded.Value.RuleMap.SHA256 != loadedRules.SHA256 {
		return diagnostic.New("AIDD_RULE_MAP_DRIFT", loaded.Value.RuleMap.Path, "build_rule_coverage", "canonical rule map changed after Design completion", loaded.Value.RuleMap, model.PathHash{Path: "docs/harness/rule-map.json", SHA256: loadedRules.SHA256})
	}
	seenRules := map[string]struct{}{}
	for index, selected := range loaded.Value.SelectedRules {
		rule, exists := loadedRules.ByID[selected.ID]
		if !exists || rule.File != selected.Path {
			return diagnostic.New("AIDD_SELECTED_RULE", fmt.Sprintf("selected_rules[%d]", index), "build_rule_coverage", "receipt-selected rule identity is invalid", rule, selected)
		}
		if _, duplicate := seenRules[selected.ID]; duplicate {
			return diagnostic.New("AIDD_SELECTED_RULE_DUPLICATE", fmt.Sprintf("selected_rules[%d].id", index), "build_rule_coverage", "receipt-selected rule IDs must be unique", "unique ID", selected.ID)
		}
		content, err := snapshot.Read(selected.Path)
		if err != nil {
			return err
		}
		if currentHash := canonical.HashBytes(content); currentHash != selected.SHA256 {
			return diagnostic.New("AIDD_SELECTED_RULE_DRIFT", selected.Path, "build_rule_coverage", "selected rule changed after Design completion", selected.SHA256, currentHash)
		}
		seenRules[selected.ID] = struct{}{}
	}
	return nil
}

type change struct {
	Path   string
	Status string
}

func changedPaths(ctx context.Context, snapshot *repository.Snapshot, baseline string, untrackedBaseline []model.UntrackedEntry) ([]change, error) {
	if len(baseline) != 40 {
		return nil, diagnostic.New("AIDD_BUILD_BASELINE", "build_baseline.head", "build_rule_coverage", "receipt Build baseline is invalid", "full commit ID", baseline)
	}
	if _, err := snapshot.Git(ctx, "merge-base", "--is-ancestor", baseline, "HEAD"); err != nil {
		return nil, diagnostic.New("AIDD_BUILD_BASELINE_ANCESTRY", "build_baseline.head", "build_rule_coverage", "receipt Build baseline must be an ancestor of current HEAD", baseline, err.Error())
	}
	headBytes, err := snapshot.Git(ctx, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return nil, err
	}
	currentHead := strings.TrimSpace(string(headBytes))
	if currentHead != baseline {
		return nil, diagnostic.New("AIDD_BUILD_HEAD_DRIFT", "build_baseline.head", "build_rule_coverage", "Build must not commit or switch HEAD before Ship", baseline, currentHead)
	}
	trackedOutput, err := snapshot.Git(ctx, "diff", "--name-status", "-z", "--find-renames", baseline, "--")
	if err != nil {
		return nil, err
	}
	trackedChanges, err := parseNameStatus(trackedOutput)
	if err != nil {
		return nil, err
	}
	stagedOutput, err := snapshot.Git(ctx, "diff", "--cached", "--name-status", "-z", "--find-renames", baseline, "--")
	if err != nil {
		return nil, err
	}
	stagedChanges, err := parseNameStatus(stagedOutput)
	if err != nil {
		return nil, err
	}
	indexWorktreeOutput, err := snapshot.Git(ctx, "diff", "--name-status", "-z", "--find-renames", "--")
	if err != nil {
		return nil, err
	}
	indexWorktreeChanges, err := parseNameStatus(indexWorktreeOutput)
	if err != nil {
		return nil, err
	}
	stagedPaths := changePaths(stagedChanges)
	for path := range changePaths(indexWorktreeChanges) {
		if _, staged := stagedPaths[path]; staged {
			return nil, diagnostic.New("AIDD_BUILD_INDEX_WORKTREE_DRIFT", path, "build_rule_coverage", "a staged Build path must match the validated worktree state", "identical index and worktree content/mode", path)
		}
	}
	currentUntracked, err := state.UntrackedInventory(ctx, snapshot, nil)
	if err != nil {
		return nil, err
	}
	trackedByPath := map[string]change{}
	for _, group := range [][]change{trackedChanges, stagedChanges} {
		for _, item := range group {
			if previous, exists := trackedByPath[item.Path]; exists && previous.Status != item.Status {
				return nil, diagnostic.New("AIDD_BUILD_GIT_STATE_CONFLICT", item.Path, "build_rule_coverage", "worktree and index classify the Build path differently", previous.Status, item.Status)
			}
			trackedByPath[item.Path] = item
		}
	}
	baselineByPath := make(map[string]model.UntrackedEntry, len(untrackedBaseline))
	for _, item := range untrackedBaseline {
		baselineByPath[item.Path] = item
	}
	currentByPath := make(map[string]model.UntrackedEntry, len(currentUntracked))
	for _, item := range currentUntracked {
		currentByPath[item.Path] = item
	}
	for path := range currentByPath {
		if tracked, exists := trackedByPath[path]; exists {
			return nil, diagnostic.New("AIDD_BUILD_INDEX_WORKTREE_DRIFT", path, "build_rule_coverage", "a Build path cannot be both a tracked diff and an untracked worktree entry", "matching tracked index and worktree state", map[string]string{"tracked_status": tracked.Status, "worktree_status": "untracked"})
		}
	}
	byPath := make(map[string]change, len(trackedByPath)+len(baselineByPath)+len(currentByPath))
	for path, item := range trackedByPath {
		byPath[path] = item
	}
	for path, expected := range baselineByPath {
		if _, tracked := trackedByPath[path]; tracked {
			continue
		}
		actual, exists := currentByPath[path]
		if !exists {
			byPath[path] = change{Path: path, Status: "D"}
			continue
		}
		if actual != expected {
			byPath[path] = change{Path: path, Status: "M"}
		}
	}
	for path := range currentByPath {
		if _, tracked := trackedByPath[path]; tracked {
			continue
		}
		if _, existed := baselineByPath[path]; !existed {
			byPath[path] = change{Path: path, Status: "A"}
		}
	}
	result := make([]change, 0, len(byPath))
	for _, item := range byPath {
		result = append(result, item)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Path < result[j].Path })
	return result, nil
}

func changePaths(changes []change) map[string]struct{} {
	result := make(map[string]struct{}, len(changes))
	for _, item := range changes {
		result[item.Path] = struct{}{}
	}
	return result
}

func parseNameStatus(output []byte) ([]change, error) {
	parts := bytes.Split(output, []byte{0})
	result := []change{}
	for index := 0; index < len(parts); {
		if len(parts[index]) == 0 {
			index++
			continue
		}
		status := string(parts[index])
		index++
		if index >= len(parts) || len(parts[index]) == 0 {
			return nil, diagnostic.New("AIDD_GIT_DIFF_FORMAT", "", "git", "Git name-status output is truncated", nil, status)
		}
		firstPath := string(parts[index])
		index++
		if _, err := pathcontract.ValidateRelativePath(firstPath); err != nil {
			return nil, err
		}
		if strings.HasPrefix(status, "R") || strings.HasPrefix(status, "C") {
			if index >= len(parts) || len(parts[index]) == 0 {
				return nil, diagnostic.New("AIDD_GIT_DIFF_FORMAT", "", "git", "Git rename/copy output is truncated", nil, status)
			}
			secondPath := string(parts[index])
			index++
			if _, err := pathcontract.ValidateRelativePath(secondPath); err != nil {
				return nil, err
			}
			result = append(result, change{Path: firstPath, Status: "D"}, change{Path: secondPath, Status: "A"})
			continue
		}
		result = append(result, change{Path: firstPath, Status: status})
	}
	return result, nil
}

func insideScopes(path string, scopes []model.OwnershipScope) bool {
	for _, scope := range scopes {
		if path == scope.Path || (scope.Kind == "tree" && strings.HasPrefix(path, scope.Path+"/")) {
			return true
		}
	}
	return false
}

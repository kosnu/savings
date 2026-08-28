package handoff

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/gates"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/render"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

const RuleMapPath = "docs/harness/rule-map.json"

type CaptureInput struct {
	IssueID        string
	IssueURL       string
	IssueUpdatedAt string
	IssueBody      []byte
	DesignGoal     []byte
	Workspace      string
	ProfilePath    string
}

func Capture(ctx context.Context, snapshot *repository.Snapshot, input CaptureInput) (string, string, error) {
	requirementsPath, err := repository.WorkspacePath(input.Workspace, "requirements.json")
	if err != nil {
		return "", "", err
	}
	designPath, err := repository.WorkspacePath(input.Workspace, "design-doc.json")
	if err != nil {
		return "", "", err
	}
	requirementsDisplayPath, err := repository.WorkspacePath(input.Workspace, "requirements.md")
	if err != nil {
		return "", "", err
	}
	designDisplayPath, err := repository.WorkspacePath(input.Workspace, "design-doc.md")
	if err != nil {
		return "", "", err
	}
	requirementsBytes, err := snapshot.Read(requirementsPath)
	if err != nil {
		return "", "", err
	}
	designBytes, err := snapshot.Read(designPath)
	if err != nil {
		return "", "", err
	}
	requirementsDisplay, err := snapshot.Read(requirementsDisplayPath)
	if err != nil {
		return "", "", err
	}
	designDisplay, err := snapshot.Read(designDisplayPath)
	if err != nil {
		return "", "", err
	}
	gateResult, err := gates.ValidateDesign(ctx, snapshot, gates.DesignInput{
		Issue: gates.IssueSnapshot{
			ID: input.IssueID, URL: input.IssueURL, UpdatedAt: input.IssueUpdatedAt, Body: input.IssueBody,
		},
		Workspace: input.Workspace, Kind: "design", Requirements: requirementsBytes,
		Document: designBytes, Goal: input.DesignGoal, RuleMapPath: RuleMapPath,
		ProfilePath: input.ProfilePath,
	})
	if err != nil {
		return "", "", err
	}
	requirements := gateResult.Requirements
	design := gateResult.Document
	goal := gateResult.Goal
	expectedRequirementsDisplay, err := render.Markdown(requirementsBytes, "requirements", requirementsPath)
	if err != nil {
		return "", "", err
	}
	if !bytes.Equal(requirementsDisplay, []byte(expectedRequirementsDisplay)) {
		return "", "", diagnostic.New("AIDD_DISPLAY_DRIFT", requirementsDisplayPath, "design_completion", "Requirements display does not match its canonical source", canonical.HashBytes([]byte(expectedRequirementsDisplay)), canonical.HashBytes(requirementsDisplay))
	}
	expectedDesignDisplay, err := render.Markdown(designBytes, "design", designPath)
	if err != nil {
		return "", "", err
	}
	if !bytes.Equal(designDisplay, []byte(expectedDesignDisplay)) {
		return "", "", diagnostic.New("AIDD_DISPLAY_DRIFT", designDisplayPath, "design_completion", "Design display does not match its canonical source", canonical.HashBytes([]byte(expectedDesignDisplay)), canonical.HashBytes(designDisplay))
	}
	if !equalJSON(design.Design.TargetState, goal.Design.TargetState) || !equalJSON(design.Design.RuleCoverage, goal.Design.RuleCoverage) {
		return "", "", diagnostic.New("AIDD_DESIGN_GOAL_DRIFT", "validation", "design_completion", "Design artifact target state and rule coverage must match the retained Goal", goal.Design, design.Design)
	}
	requirementIDs := make([]string, len(requirements.Requirements.Requirements))
	for index, requirement := range requirements.Requirements.Requirements {
		requirementIDs[index] = requirement.ID
	}
	if err := semantic.ValidateTargetState(&design.Design.TargetState, requirementIDs, "design"); err != nil {
		return "", "", err
	}
	resolvedCatalog := gateResult.Catalog
	selectedProfiles, err := semantic.ValidateProfiles(&design.Design.TargetState, resolvedCatalog, "design")
	if err != nil {
		return "", "", err
	}
	loadedRules := gateResult.Rules
	selectedRuleIDs, err := rules.SelectedIDs(requirementsBytes, designBytes, loadedRules)
	if err != nil {
		return "", "", err
	}
	selectedRules := make([]model.SelectedRule, 0, len(selectedRuleIDs))
	for _, id := range selectedRuleIDs {
		rule := loadedRules.ByID[id]
		content, readErr := snapshot.Read(rule.File)
		if readErr != nil {
			return "", "", readErr
		}
		selectedRules = append(selectedRules, model.SelectedRule{ID: id, Path: rule.File, SHA256: canonical.HashBytes(content)})
	}
	baselineInventory, err := state.Inventory(snapshot, &design.Design.TargetState)
	if err != nil {
		return "", "", err
	}
	headBytes, err := snapshot.Git(ctx, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return "", "", err
	}
	head := strings.TrimSpace(string(headBytes))
	if len(head) != 40 {
		return "", "", diagnostic.New("AIDD_BUILD_BASELINE", "build_baseline.head", "design_completion", "Build baseline must be a full Git commit ID", "40 hexadecimal characters", head)
	}
	receiptValue := model.Receipt{
		SchemaVersion: model.ReceiptSchemaVersion,
		Kind:          "design_completion",
		Workspace:     input.Workspace,
		Issue: model.IssueReceipt{
			ID: input.IssueID, Title: requirements.Requirements.CycleStartIssueTitle,
			URL: input.IssueURL, UpdatedAt: input.IssueUpdatedAt,
			BodySHA256: canonical.HashBytes(input.IssueBody),
		},
		DesignGoalSHA256:     canonical.HashBytes(input.DesignGoal),
		RuleMap:              model.PathHash{Path: RuleMapPath, SHA256: loadedRules.SHA256},
		SelectedRules:        selectedRules,
		VerificationProfiles: model.ProfileReceipt{Path: input.ProfilePath, SHA256: resolvedCatalog.SHA256, Selected: selectedProfiles},
		RuleCoverage:         hashValue(design.Design.RuleCoverage),
		TargetState:          hashValue(design.Design.TargetState),
		OwnershipScopes:      hashValue(design.Design.TargetState.OwnershipScopes),
		BaselineInventory:    hashValue(baselineInventory),
		BuildBaseline:        model.BuildBaseline{Head: head},
		Artifacts: model.ReceiptArtifacts{
			Requirements: model.ArtifactPair{
				Source:  model.PathHash{Path: requirementsPath, SHA256: canonical.HashBytes(requirementsBytes)},
				Display: model.PathHash{Path: requirementsDisplayPath, SHA256: canonical.HashBytes(requirementsDisplay)},
			},
			Design: model.ArtifactPair{
				Source:  model.PathHash{Path: designPath, SHA256: canonical.HashBytes(designBytes)},
				Display: model.PathHash{Path: designDisplayPath, SHA256: canonical.HashBytes(designDisplay)},
			},
		},
	}
	serialized, err := canonical.Pretty(receiptValue)
	if err != nil {
		return "", "", err
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return "", "", err
	}
	receiptPath, err := receipt.Path(input.Workspace)
	if err != nil {
		return "", "", err
	}
	if err := snapshot.WriteAtomic(receiptPath, serialized); err != nil {
		return "", "", err
	}
	return receiptPath, canonical.HashBytes(serialized), nil
}

type CheckInput struct {
	IssueID        string
	IssueURL       string
	IssueUpdatedAt string
	IssueBody      []byte
	Workspace      string
	ExpectedSHA256 string
}

func Check(snapshot *repository.Snapshot, input CheckInput) (*receipt.Loaded, error) {
	loaded, err := receipt.Load(snapshot, input.Workspace, input.ExpectedSHA256)
	if err != nil {
		return nil, err
	}
	issue := loaded.Value.Issue
	expectedIssue := model.IssueReceipt{
		ID: input.IssueID, Title: issue.Title, URL: input.IssueURL,
		UpdatedAt: input.IssueUpdatedAt, BodySHA256: canonical.HashBytes(input.IssueBody),
	}
	if !equalJSON(issue, expectedIssue) {
		return nil, diagnostic.New("AIDD_ISSUE_DRIFT", "issue", "design_completion", "current Issue snapshot does not match Design completion", issue, expectedIssue)
	}
	if loaded.Value.RuleMap.Path != RuleMapPath {
		return nil, diagnostic.New("AIDD_RULE_MAP_PATH", "rule_map.path", "design_completion", "receipt must use the canonical rule-map path", RuleMapPath, loaded.Value.RuleMap.Path)
	}
	ruleMapBytes, err := snapshot.Read(RuleMapPath)
	if err != nil {
		return nil, err
	}
	if currentHash := canonical.HashBytes(ruleMapBytes); currentHash != loaded.Value.RuleMap.SHA256 {
		return nil, diagnostic.New("AIDD_RULE_MAP_DRIFT", RuleMapPath, "design_completion", "rule map changed after Design completion", loaded.Value.RuleMap.SHA256, currentHash)
	}
	artifactPairs := []struct {
		kind string
		pair model.ArtifactPair
	}{{kind: "requirements", pair: loaded.Value.Artifacts.Requirements}, {kind: "design", pair: loaded.Value.Artifacts.Design}}
	for _, artifact := range artifactPairs {
		for _, part := range []struct {
			name   string
			record model.PathHash
		}{{name: "source", record: artifact.pair.Source}, {name: "display", record: artifact.pair.Display}} {
			record := part.record
			content, readErr := snapshot.Read(record.Path)
			if readErr != nil {
				return nil, readErr
			}
			if currentHash := canonical.HashBytes(content); currentHash != record.SHA256 {
				return nil, diagnostic.New("AIDD_ARTIFACT_DRIFT", record.Path, "design_completion", artifact.kind+" "+part.name+" changed after Design completion", record.SHA256, currentHash)
			}
		}
	}
	for _, record := range loaded.Value.SelectedRules {
		content, readErr := snapshot.Read(record.Path)
		if readErr != nil {
			return nil, readErr
		}
		if currentHash := canonical.HashBytes(content); currentHash != record.SHA256 {
			return nil, diagnostic.New("AIDD_SELECTED_RULE_DRIFT", record.Path, "design_completion", "selected rule changed after Design completion", record.SHA256, currentHash)
		}
	}
	requirementsSource := loaded.Value.Artifacts.Requirements.Source
	requirementsBytes, err := snapshot.Read(requirementsSource.Path)
	if err != nil {
		return nil, err
	}
	parsedRequirements, err := semantic.ParseSource(requirementsBytes, "requirements", "requirements")
	if err != nil {
		return nil, err
	}
	if parsedRequirements.ReadOnlyLegacy || parsedRequirements.Requirements.CycleStartIssueTitle != issue.Title {
		return nil, diagnostic.New("AIDD_RECEIPT_REQUIREMENTS_MISMATCH", requirementsSource.Path, "design_completion", "current Requirements title does not match the receipt", issue.Title, parsedRequirements.Requirements.CycleStartIssueTitle)
	}
	designSource := loaded.Value.Artifacts.Design.Source
	designBytes, err := snapshot.Read(designSource.Path)
	if err != nil {
		return nil, err
	}
	parsedDesign, err := semantic.ParseSource(designBytes, "design", "design")
	if err != nil {
		return nil, err
	}
	if parsedDesign.ReadOnlyLegacy || !equalJSON(parsedDesign.Design.TargetState, loaded.Value.TargetState.Value) || !equalJSON(parsedDesign.Design.RuleCoverage, loaded.Value.RuleCoverage.Value) {
		return nil, diagnostic.New("AIDD_RECEIPT_DESIGN_MISMATCH", designSource.Path, "design_completion", "current Design target state or rule coverage does not match the receipt", loaded.Value.TargetState.Value, parsedDesign.Design)
	}
	canonicalReceipt, err := canonical.Pretty(loaded.Value)
	if err != nil {
		return nil, err
	}
	if string(canonicalReceipt) != string(loaded.Bytes) {
		return nil, diagnostic.New("AIDD_RECEIPT_CANONICAL", "", "design_completion", "Design completion receipt must use canonical JSON serialization", string(canonicalReceipt), string(loaded.Bytes))
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return nil, err
	}
	return loaded, nil
}

func hashValue[T any](value T) model.HashValue[T] {
	hash, err := canonical.Hash(value)
	if err != nil {
		panic(err)
	}
	return model.HashValue[T]{SHA256: hash, Value: value}
}

func equalJSON(left, right any) bool {
	leftBytes, leftErr := canonical.Marshal(left)
	rightBytes, rightErr := canonical.Marshal(right)
	return leftErr == nil && rightErr == nil && string(leftBytes) == string(rightBytes)
}

func ReadExternal(path string) ([]byte, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	info, err := os.Lstat(absolute)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("external input must be a regular non-symlink file: %s", path)
	}
	return os.ReadFile(absolute)
}

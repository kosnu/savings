package handoff

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/gates"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/render"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/requirementscontract"
)

const testWorkspace = "1671-checker"

func handoffIssueBody() []byte {
	lines := []string{"repo-owned checker profileでverificationを固定する"}
	for index := 0; index < 9; index++ {
		lines = append(lines, fmt.Sprintf("section-evidence-%02d", index+1))
	}
	return []byte(strings.Join(lines, "\n"))
}

func TestValidateDesignAcceptsCanonicalFixture(t *testing.T) {
	repoRoot := initializeFixtureRepository(t)
	workspaceRoot := filepath.Join(repoRoot, "docs", "ai-driven-development", "workspaces", testWorkspace)
	requirements, err := os.ReadFile(filepath.Join(workspaceRoot, "requirements.json"))
	if err != nil {
		t.Fatal(err)
	}
	design, err := os.ReadFile(filepath.Join(workspaceRoot, "design-doc.json"))
	if err != nil {
		t.Fatal(err)
	}
	goal, err := os.ReadFile(filepath.Join(repoRoot, "design-goal.json"))
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()

	result, err := gates.ValidateDesign(context.Background(), snapshot, gates.DesignInput{
		Issue: gates.IssueSnapshot{
			ID: "owner/repo#1671", URL: "https://github.com/owner/repo/issues/1671",
			UpdatedAt: "2026-08-28T00:00:00Z", Body: handoffIssueBody(),
		},
		Workspace: testWorkspace, Kind: "design", Requirements: requirements,
		Document: design, Goal: goal, RuleMapPath: RuleMapPath, ProfilePath: catalog.DefaultPath,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Requirements == nil || result.Document == nil || result.Goal == nil {
		t.Fatalf("Design gate did not return all validated sources: %#v", result)
	}
}

func TestValidateDesignRejectsAutomaticAdditionalRule(t *testing.T) {
	repoRoot := initializeFixtureRepository(t)
	workspaceRoot := filepath.Join(repoRoot, "docs", "ai-driven-development", "workspaces", testWorkspace)
	requirements, err := os.ReadFile(filepath.Join(workspaceRoot, "requirements.json"))
	if err != nil {
		t.Fatal(err)
	}
	design, err := os.ReadFile(filepath.Join(workspaceRoot, "design-doc.json"))
	if err != nil {
		t.Fatal(err)
	}
	goal, err := os.ReadFile(filepath.Join(repoRoot, "design-goal.json"))
	if err != nil {
		t.Fatal(err)
	}
	var source map[string]any
	if err := json.Unmarshal(design, &source); err != nil {
		t.Fatal(err)
	}
	validation := source["validation"].(map[string]any)
	coverage := validation["rule_coverage"].(map[string]any)
	coverage["additional_rules"] = []any{map[string]any{"id": "ai-driven.checker", "reason": "重複した自動rule"}}
	design, err = canonical.Pretty(source)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	_, err = gates.ValidateDesign(context.Background(), snapshot, gates.DesignInput{
		Issue: gates.IssueSnapshot{
			ID: "owner/repo#1671", URL: "https://github.com/owner/repo/issues/1671",
			UpdatedAt: "2026-08-28T00:00:00Z", Body: handoffIssueBody(),
		},
		Workspace: testWorkspace, Kind: "design", Requirements: requirements,
		Document: design, Goal: goal, RuleMapPath: RuleMapPath, ProfilePath: catalog.DefaultPath,
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_ADDITIONAL_RULE_AUTOMATIC") {
		t.Fatalf("expected automatic additional rule rejection, got %v", err)
	}
}

func TestReceiptFixesProfileCatalogAndBuildEntry(t *testing.T) {
	repoRoot := initializeFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	designGoalPath := filepath.Join(repoRoot, "design-goal.json")
	designGoal, err := os.ReadFile(designGoalPath)
	if err != nil {
		t.Fatal(err)
	}
	issueBody := handoffIssueBody()
	statusBefore := statusLines(runGitOutput(t, repoRoot, "status", "--porcelain=v1", "--untracked-files=all"))
	receiptPath, receiptHash, err := Capture(context.Background(), snapshot, CaptureInput{
		IssueID: "owner/repo#1671", IssueURL: "https://github.com/owner/repo/issues/1671",
		IssueUpdatedAt: "2026-08-28T00:00:00Z", IssueBody: issueBody,
		DesignGoal: designGoal, Workspace: testWorkspace, ProfilePath: catalog.DefaultPath,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(receiptPath, "/.aidd/design-completion.json") {
		t.Fatalf("unexpected receipt path: %s", receiptPath)
	}
	statusAfter := statusLines(runGitOutput(t, repoRoot, "status", "--porcelain=v1", "--untracked-files=all"))
	expectedStatus := append(statusBefore, "?? docs/ai-driven-development/workspaces/"+testWorkspace+"/.aidd/design-completion.json")
	sort.Strings(expectedStatus)
	if strings.Join(statusAfter, "\n") != strings.Join(expectedStatus, "\n") {
		t.Fatalf("capture-design wrote undeclared repository paths\nexpected: %s\nactual: %s", strings.Join(expectedStatus, "\n"), strings.Join(statusAfter, "\n"))
	}

	checkSnapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := Check(context.Background(), checkSnapshot, CheckInput{
		IssueID: "owner/repo#1671", IssueURL: "https://github.com/owner/repo/issues/1671",
		IssueUpdatedAt: "2026-08-28T00:00:00Z", IssueBody: issueBody,
		Workspace: testWorkspace, ExpectedSHA256: receiptHash,
	})
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Value.VerificationProfiles.Selected[0].ID != "git-diff-check" {
		t.Fatalf("selected profile was not fixed: %#v", loaded.Value.VerificationProfiles)
	}
	untrackedPaths := map[string]struct{}{}
	for _, entry := range loaded.Value.UntrackedBaseline.Value {
		untrackedPaths[entry.Path] = struct{}{}
	}
	if _, exists := untrackedPaths["design-goal.json"]; !exists {
		t.Fatalf("pre-existing untracked path was not fixed: %#v", loaded.Value.UntrackedBaseline.Value)
	}
	if _, exists := untrackedPaths[receiptPath]; exists {
		t.Fatalf("receipt output recursively entered its own baseline: %#v", loaded.Value.UntrackedBaseline.Value)
	}

	profilePath := filepath.Join(repoRoot, filepath.FromSlash(catalog.DefaultPath))
	var profiles model.ProfileCatalog
	profileBytes, _ := os.ReadFile(profilePath)
	if err := json.Unmarshal(profileBytes, &profiles); err != nil {
		t.Fatal(err)
	}
	profiles.Profiles[0].Argv = append(profiles.Profiles[0].Argv, "--quiet")
	writeJSON(t, profilePath, profiles)

	driftSnapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	_, err = receipt.Load(context.Background(), driftSnapshot, testWorkspace, receiptHash)
	if err == nil || !strings.Contains(err.Error(), "AIDD_PROFILE_DRIFT") {
		t.Fatalf("expected profile drift rejection, got %v", err)
	}
}

func TestBuildEntryRejectsGitHeadDrift(t *testing.T) {
	repoRoot := initializeFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	designGoal, err := os.ReadFile(filepath.Join(repoRoot, "design-goal.json"))
	if err != nil {
		t.Fatal(err)
	}
	issueBody := handoffIssueBody()
	receiptPath, receiptHash, err := Capture(context.Background(), snapshot, CaptureInput{
		IssueID: "owner/repo#1671", IssueURL: "https://github.com/owner/repo/issues/1671",
		IssueUpdatedAt: "2026-08-28T00:00:00Z", IssueBody: issueBody,
		DesignGoal: designGoal, Workspace: testWorkspace, ProfilePath: catalog.DefaultPath,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := snapshot.Close(); err != nil {
		t.Fatal(err)
	}
	runGit(t, repoRoot, "add", receiptPath)
	runGit(t, repoRoot, "commit", "-qm", "unexpected pre-Build commit")

	checkSnapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer checkSnapshot.Close()
	_, err = Check(context.Background(), checkSnapshot, CheckInput{
		IssueID: "owner/repo#1671", IssueURL: "https://github.com/owner/repo/issues/1671",
		IssueUpdatedAt: "2026-08-28T00:00:00Z", IssueBody: issueBody,
		Workspace: testWorkspace, ExpectedSHA256: receiptHash,
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_HEAD_DRIFT") {
		t.Fatalf("expected Build entry HEAD drift rejection, got %v", err)
	}
}

func TestCaptureRejectsIncompleteRequirementCoverage(t *testing.T) {
	repoRoot := initializeFixtureRepository(t)
	workspaceRoot := filepath.Join(repoRoot, "docs", "ai-driven-development", "workspaces", testWorkspace)
	designPath := filepath.Join(workspaceRoot, "design-doc.json")
	goalPath := filepath.Join(repoRoot, "design-goal.json")

	for _, path := range []string{designPath, goalPath} {
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var source map[string]any
		if err := json.Unmarshal(content, &source); err != nil {
			t.Fatal(err)
		}
		validation := source["validation"].(map[string]any)
		coverageGate := validation["coverage_gate"].(map[string]any)
		coverageGate["coverage"] = []any{}
		writeJSON(t, path, source)
	}
	designGoal, err := os.ReadFile(goalPath)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Capture(context.Background(), snapshot, CaptureInput{
		IssueID: "owner/repo#1671", IssueURL: "https://github.com/owner/repo/issues/1671",
		IssueUpdatedAt: "2026-08-28T00:00:00Z", IssueBody: handoffIssueBody(),
		DesignGoal: designGoal, Workspace: testWorkspace, ProfilePath: catalog.DefaultPath,
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_COVERAGE_INVENTORY") {
		t.Fatalf("expected incomplete coverage rejection, got %v", err)
	}
}

func TestReceiptWithoutUntrackedBaselineFailsClosed(t *testing.T) {
	repoRoot := initializeFixtureRepository(t)
	designGoal, err := os.ReadFile(filepath.Join(repoRoot, "design-goal.json"))
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	receiptPath, _, err := Capture(context.Background(), snapshot, CaptureInput{
		IssueID: "owner/repo#1671", IssueURL: "https://github.com/owner/repo/issues/1671",
		IssueUpdatedAt: "2026-08-28T00:00:00Z", IssueBody: handoffIssueBody(),
		DesignGoal: designGoal, Workspace: testWorkspace, ProfilePath: catalog.DefaultPath,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := snapshot.Close(); err != nil {
		t.Fatal(err)
	}
	absoluteReceiptPath := filepath.Join(repoRoot, filepath.FromSlash(receiptPath))
	content, err := os.ReadFile(absoluteReceiptPath)
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if err := json.Unmarshal(content, &value); err != nil {
		t.Fatal(err)
	}
	delete(value, "untracked_baseline")
	writeJSON(t, absoluteReceiptPath, value)
	modified, err := os.ReadFile(absoluteReceiptPath)
	if err != nil {
		t.Fatal(err)
	}
	checkSnapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer checkSnapshot.Close()
	_, err = receipt.Load(context.Background(), checkSnapshot, testWorkspace, canonical.HashBytes(modified))
	if err == nil || !strings.Contains(err.Error(), "AIDD_RECEIPT_UNTRACKED_BASELINE") {
		t.Fatalf("receipt without untracked baseline was accepted: %v", err)
	}
}

func initializeFixtureRepository(t *testing.T) string {
	t.Helper()
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init", "-q")
	runGit(t, repoRoot, "config", "user.name", "AIDD Test")
	runGit(t, repoRoot, "config", "user.email", "aidd@example.com")

	rulePath := filepath.Join(repoRoot, "docs", "rules", "checker.md")
	writeFile(t, rulePath, []byte("# Checker\n\nprofile trust boundary.\n"))
	ruleMap := map[string]any{
		"version":          2,
		"description":      "fixture",
		"resolution_order": []string{"depends_on"},
		"review_routing": map[string]any{
			"governed_paths": []string{"unrelated/**"},
			"surfaces": []any{map[string]any{
				"id": "unrelated", "paths": []string{"unrelated/**"}, "required_rules": []string{"ai-driven.checker"},
			}},
		},
		"rules": []any{map[string]any{
			"id": "ai-driven.checker", "file": "docs/rules/checker.md",
			"applies_to": map[string]any{"paths": []string{"tool.txt"}, "domains": []string{}, "activities": []string{}, "topics": []string{"checker"}},
			"depends_on": []string{}, "overrides": []string{}, "priority": 100,
		}},
	}
	writeJSON(t, filepath.Join(repoRoot, RuleMapPath), ruleMap)

	profiles := model.ProfileCatalog{SchemaVersion: 1, Profiles: []model.VerificationProfile{{
		ID: "git-diff-check", Contract: "suite", Runner: "command_suite", SelectorKind: "suite",
		SelectorRoot: "", WorkingDirectory: "", Argv: []string{"git", "diff", "--check"},
	}}}
	writeJSON(t, filepath.Join(repoRoot, filepath.FromSlash(catalog.DefaultPath)), profiles)
	requirementsSectionHeadings := map[string]string{
		"background": "背景", "users": "対象ユーザー", "stories": "ユーザーストーリー",
		"scope": "スコープ", "functional": "機能要件", "non-functional": "非機能要件",
		"acceptance": "受け入れ条件", "qa": "Q&A", "technical": "技術的考慮事項",
	}
	requirementsSectionIDs := []string{"background", "users", "stories", "scope", "functional", "non-functional", "acceptance", "qa", "technical"}
	contractSections := make([]any, len(requirementsSectionIDs))
	for index, id := range requirementsSectionIDs {
		contractSections[index] = map[string]any{"id": id, "headings": []string{requirementsSectionHeadings[id]}}
	}
	writeJSON(t, filepath.Join(repoRoot, filepath.FromSlash(requirementscontract.DefaultPath)), map[string]any{"schema_version": 1, "sections": contractSections})
	writeFile(t, filepath.Join(repoRoot, "tool.txt"), []byte("target\n"))
	runGit(t, repoRoot, "add", ".")
	runGit(t, repoRoot, "commit", "-qm", "fixture baseline")

	target := model.TargetState{
		ProductBehaviors:  []model.ProductBehavior{{ID: "PB-1", Type: "state_transition", Description: "固定profileで検証済み状態になる", RequirementID: "FR-1"}},
		VerificationCases: []model.VerificationCase{{ID: "VC-1", Type: "automated", RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationProfileID: "git-diff-check", Selector: &model.Selector{Kind: "suite"}}},
		OwnershipScopes:   []model.OwnershipScope{{Path: "tool.txt", Kind: "file"}},
		Representations:   []model.Representation{{ID: "REP-1", Kind: "implementation", Path: "tool.txt", Locator: model.Locator{Kind: "file"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationCaseIDs: []string{"VC-1"}}},
	}
	issueBody := handoffIssueBody()
	inputGate := map[string]any{
		"task_context": map[string]any{"source": "issue_body", "issue": "owner/repo#1671", "url": "https://github.com/owner/repo/issues/1671", "updated_at": "2026-08-28T00:00:00Z", "body_sha256": canonical.HashBytes(issueBody)},
		"direct_rules": []any{map[string]any{"id": "ai-driven.checker", "issue_evidence": "repo-owned checker profile", "match": map[string]any{"field": "topics", "value": "checker"}, "reason": "profile boundary"}},
		"depends_on":   []any{},
	}
	requirementsSections := make([]any, len(requirementsSectionIDs))
	sectionTransitions := make([]any, len(requirementsSectionIDs))
	for index, id := range requirementsSectionIDs {
		sectionEvidence := fmt.Sprintf("section-evidence-%02d", index+1)
		block := map[string]any{"id": id + "-body", "type": "markdown", "markdown": sectionEvidence + " を " + id + " で扱う。"}
		if id == "functional" {
			block = map[string]any{"id": id + "-requirements", "type": "requirements"}
		}
		requirementsSections[index] = map[string]any{"id": id, "heading": requirementsSectionHeadings[id], "blocks": []any{block}}
		sectionTransitions[index] = map[string]any{"id": id, "status": "new", "issue_evidence": sectionEvidence}
	}
	completeness := map[string]any{
		"issue_body_sha256": canonical.HashBytes(issueBody),
		"workspace":         testWorkspace,
		"baseline":          map[string]any{"source": "none", "body_sha256": nil},
		"requirements":      []any{map[string]any{"id": "FR-1", "status": "new", "issue_evidence": "repo-owned checker profile"}},
		"sections":          sectionTransitions,
		"retired":           []any{},
	}
	requirements := map[string]any{
		"schema_version": 4, "kind": "requirements", "workspace": testWorkspace,
		"display": map[string]any{"path": "requirements.md", "preamble": "# Requirements"},
		"validation": map[string]any{
			"mode": "managed", "cycle_start_issue_title": "Checker profile boundary",
			"input_gate": inputGate, "completeness_gate": completeness,
			"requirements": []any{map[string]any{"id": "FR-1", "section_id": "functional", "text": "repo-owned checker profileでverificationを固定する。section-evidence-05"}},
			"sections":     requirementsSections,
		},
	}
	requirementsBytes, err := canonical.Pretty(requirements)
	if err != nil {
		t.Fatal(err)
	}
	designSections := []any{map[string]any{
		"id": "architecture", "heading": "Architecture", "blocks": []any{
			map[string]any{"id": "fr-1-design", "type": "evidence", "role": "design", "owner_id": "FR-1", "text": "FR-1 はcatalog固定境界で実装する。", "product_behavior_ids": []string{"PB-1"}},
			map[string]any{"id": "fr-1-verification", "type": "evidence", "role": "verification", "owner_id": "FR-1", "text": "FR-1 は固定profileのsuiteで検証する。"},
		},
	}}
	designValidation := map[string]any{
		"mode": "managed", "sections": designSections, "target_state": target,
		"rule_coverage": model.RuleCoverage{ImplementationSurfaces: []string{}, AdditionalRules: []model.AdditionalRule{}},
		"coverage_gate": map[string]any{
			"requirements_sha256": canonical.HashBytes(requirementsBytes),
			"workspace":           testWorkspace,
			"requirement_ids":     []string{"FR-1"},
			"baseline":            map[string]any{"source": "none", "body_sha256": nil},
			"coverage":            []any{map[string]any{"id": "FR-1", "design_block_id": "fr-1-design", "verification_block_id": "fr-1-verification"}},
			"baseline_sections":   []any{},
		},
	}
	design := map[string]any{
		"schema_version": 4, "kind": "design", "workspace": testWorkspace,
		"display": map[string]any{"path": "design-doc.md", "preamble": "# Design"}, "validation": designValidation,
	}
	designGoal := map[string]any{
		"schema_version": 4, "kind": "design_goal", "workspace": testWorkspace,
		"display": map[string]any{
			"path": "goal.md", "title": "Design Goal", "goal": "全Requirements IDの完成状態と検証方針を定義する。",
			"context": map[string]any{
				"body": []any{"検証済みRequirementsをread-only入力としてDesignを定義する。"},
				"constraints": []any{
					map[string]any{"id": "canonical-input", "text": "検証済みのcanonical requirements.jsonをread-only入力として扱う。"},
					map[string]any{"id": "phase-boundary", "text": "Design Goal内では実装しない。"},
				},
				"stop": []any{
					map[string]any{"id": "validation-failure", "text": "Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。"},
					map[string]any{"id": "scope-ambiguity", "text": "要求ごとの設計・検証scopeを一意に決められない場合は停止する。"},
				},
			},
			"done": []any{
				map[string]any{"id": "complete-scope", "text": "全Requirements IDとtask-owned範囲の完成状態を定義する。"},
				map[string]any{"id": "validated-artifact", "text": "Design Coverage Gateと生成成果物の同期検証後にcompletion receiptを固定する。"},
			},
		},
		"validation": designValidation,
	}
	workspaceRoot := filepath.Join(repoRoot, "docs", "ai-driven-development", "workspaces", testWorkspace)
	writeFile(t, filepath.Join(workspaceRoot, "requirements.json"), requirementsBytes)
	requirementsDisplay, err := render.Markdown(requirementsBytes, "requirements", "requirements")
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(workspaceRoot, "requirements.md"), []byte(requirementsDisplay))

	designBytes, err := canonical.Pretty(design)
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(workspaceRoot, "design-doc.json"), designBytes)
	designDisplay, err := render.Markdown(designBytes, "design", "design")
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(workspaceRoot, "design-doc.md"), []byte(designDisplay))
	writeJSON(t, filepath.Join(repoRoot, "design-goal.json"), designGoal)
	return repoRoot
}

func statusLines(output string) []string {
	trimmed := strings.TrimSpace(output)
	if trimmed == "" {
		return nil
	}
	lines := strings.Split(trimmed, "\n")
	sort.Strings(lines)
	return lines
}

func runGit(t *testing.T, repoRoot string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repoRoot}, arguments...)...)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
}

func runGitOutput(t *testing.T, repoRoot string, arguments ...string) string {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repoRoot}, arguments...)...)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
	return string(output)
}

func writeJSON(t *testing.T, path string, value any) {
	t.Helper()
	content, err := canonical.Pretty(value)
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, path, content)
}

func writeFile(t *testing.T, path string, content []byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
}

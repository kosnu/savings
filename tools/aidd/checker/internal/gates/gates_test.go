package gates

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/requirementscontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

var fixtureRequirementsSections = []struct {
	ID      string
	Heading string
}{
	{"background", "背景"},
	{"users", "対象ユーザー"},
	{"stories", "ユーザーストーリー"},
	{"scope", "スコープ"},
	{"functional", "機能要件"},
	{"non-functional", "非機能要件"},
	{"acceptance", "受け入れ条件"},
	{"qa", "Q&A"},
	{"technical", "技術的考慮事項"},
}

func fixtureIssueBody(extra ...string) []byte {
	lines := []string{"repo-owned checker profileでverificationを固定する"}
	for index := range fixtureRequirementsSections {
		lines = append(lines, fmt.Sprintf("section-evidence-%02d", index+1))
	}
	lines = append(lines, extra...)
	return []byte(strings.Join(lines, "\n"))
}

func TestRequirementsRejectsTransitionWithoutBaseline(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	document, goal := requirementsFixtureSources(t, issue, "changed")
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_TRANSITION_BASELINE") {
		t.Fatalf("expected transition baseline rejection, got %v", err)
	}
}

func TestTransitionEvidenceHasExactlyOneContentOwner(t *testing.T) {
	for _, ownerKind := range []string{"Requirement", "section"} {
		t.Run(ownerKind, func(t *testing.T) {
			evidenceA := "根拠A"
			evidenceB := "根拠B"
			items := []model.RequirementTransition{
				{ID: "owner-a", Status: "new", IssueEvidence: &evidenceA},
				{ID: "owner-b", Status: "new", IssueEvidence: &evidenceB},
			}
			issueBody := evidenceA + "\n" + evidenceB
			contents := map[string]string{"owner-a": evidenceA, "owner-b": evidenceB}
			if err := validateOwnedTransitions(items, issueBody, contents, "requirements", ownerKind); err != nil {
				t.Fatalf("valid ownership rejected: %v", err)
			}

			duplicate := append([]model.RequirementTransition(nil), items...)
			duplicate[1].IssueEvidence = &evidenceA
			if err := validateOwnedTransitions(duplicate, issueBody, contents, "requirements", ownerKind); err == nil || !strings.Contains(err.Error(), "EVIDENCE_DUPLICATE") {
				t.Fatalf("expected duplicate evidence rejection, got %v", err)
			}

			ambiguousContents := map[string]string{"owner-a": evidenceA, "owner-b": evidenceB + " " + evidenceA}
			if err := validateOwnedTransitions(items, issueBody, ambiguousContents, "requirements", ownerKind); err == nil || !strings.Contains(err.Error(), "EVIDENCE_AMBIGUOUS") {
				t.Fatalf("expected cross-owner evidence rejection, got %v", err)
			}

			wrongOwner := map[string]string{"owner-a": "別の内容", "owner-b": evidenceB}
			if err := validateOwnedTransitions(items, issueBody, wrongOwner, "requirements", ownerKind); err == nil || !strings.Contains(err.Error(), "EVIDENCE_OWNER") {
				t.Fatalf("expected missing owner evidence rejection, got %v", err)
			}
		})
	}
}

func TestRetirementEvidenceMustNameAndAffirmRetirement(t *testing.T) {
	for _, test := range []struct {
		name     string
		evidence string
		wantCode string
	}{
		{name: "japanese", evidence: "FR-1を廃止する"},
		{name: "english", evidence: "FR-1 is removed"},
		{name: "missing id", evidence: "この要件を廃止する", wantCode: "AIDD_RETIRED_EVIDENCE_ID"},
		{name: "wrong id", evidence: "FR-10を廃止する", wantCode: "AIDD_RETIRED_EVIDENCE_ID"},
		{name: "ambiguous ids", evidence: "FR-1とFR-2を廃止する", wantCode: "AIDD_RETIRED_EVIDENCE_AMBIGUOUS"},
		{name: "missing intent", evidence: "FR-1を維持する", wantCode: "AIDD_RETIRED_EVIDENCE_INTENT"},
		{name: "negated japanese", evidence: "FR-1を削除しない", wantCode: "AIDD_RETIRED_EVIDENCE_NEGATED"},
		{name: "negated english", evidence: "FR-1 must not be removed", wantCode: "AIDD_RETIRED_EVIDENCE_NEGATED"},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := validateRetirementEvidence(model.RequirementRetirement{ID: "FR-1", IssueEvidence: test.evidence}, test.evidence, "retired[0]", "requirements")
			if test.wantCode == "" && err != nil {
				t.Fatalf("valid retirement evidence rejected: %v", err)
			}
			if test.wantCode != "" && (err == nil || !strings.Contains(err.Error(), test.wantCode)) {
				t.Fatalf("expected %s, got %v", test.wantCode, err)
			}
		})
	}
}

func TestRequirementsSectionHashIncludesOwnedRequirementText(t *testing.T) {
	section := model.Section{ID: "functional", Heading: "機能要件", Blocks: []model.Block{{ID: "requirements", Type: "requirements"}}}
	before := map[string]model.Requirement{"FR-1": {ID: "FR-1", SectionID: "functional", Text: "変更前"}}
	after := map[string]model.Requirement{"FR-1": {ID: "FR-1", SectionID: "functional", Text: "変更後"}}
	beforeHash, err := requirementsSectionHash(section, before)
	if err != nil {
		t.Fatal(err)
	}
	afterHash, err := requirementsSectionHash(section, after)
	if err != nil {
		t.Fatal(err)
	}
	if beforeHash == afterHash {
		t.Fatal("owned Requirement text did not change the section transition hash")
	}
}

func TestAdditionalRulesPreserveManualProvenanceAndCanonicalOrder(t *testing.T) {
	loaded := &rules.Loaded{
		ByID: map[string]rules.Rule{
			"automatic":            {ID: "automatic", DependsOn: []string{"automatic-dependency"}},
			"automatic-dependency": {ID: "automatic-dependency"},
			"additional-a":         {ID: "additional-a"},
			"additional-b":         {ID: "additional-b"},
		},
		Order: []string{"automatic", "automatic-dependency", "additional-a", "additional-b"},
	}
	automatic := map[string]struct{}{"automatic": {}}
	for _, test := range []struct {
		name       string
		additional []model.AdditionalRule
		wantCode   string
	}{
		{name: "valid", additional: []model.AdditionalRule{{ID: "additional-a"}, {ID: "additional-b"}}},
		{name: "automatic direct", additional: []model.AdditionalRule{{ID: "automatic"}}, wantCode: "AIDD_ADDITIONAL_RULE_AUTOMATIC"},
		{name: "automatic dependency", additional: []model.AdditionalRule{{ID: "automatic-dependency"}}, wantCode: "AIDD_ADDITIONAL_RULE_AUTOMATIC"},
		{name: "unknown", additional: []model.AdditionalRule{{ID: "missing"}}, wantCode: "AIDD_ADDITIONAL_RULE_UNKNOWN"},
		{name: "reordered", additional: []model.AdditionalRule{{ID: "additional-b"}, {ID: "additional-a"}}, wantCode: "AIDD_ADDITIONAL_RULE_ORDER"},
	} {
		t.Run(test.name, func(t *testing.T) {
			selected, err := validateAdditionalRules(test.additional, automatic, loaded, "design")
			if test.wantCode == "" {
				if err != nil {
					t.Fatal(err)
				}
				if len(selected) != 3 {
					t.Fatalf("selected direct rule count = %d, want 3", len(selected))
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), test.wantCode) {
				t.Fatalf("expected %s, got %v", test.wantCode, err)
			}
		})
	}
}

func TestSelectedRuleDocumentCannotBeBuildOwned(t *testing.T) {
	loaded := &rules.Loaded{
		ByID: map[string]rules.Rule{
			"domain.user": {ID: "domain.user", File: "docs/harness/domain/user.md"},
		},
		Order: []string{"domain.user"},
	}
	selected := map[string]struct{}{"domain.user": {}}

	for _, test := range []struct {
		name     string
		scopes   []model.OwnershipScope
		wantCode string
	}{
		{
			name:     "exact file scope",
			scopes:   []model.OwnershipScope{{Path: "docs/harness/domain/user.md", Kind: "file"}},
			wantCode: "AIDD_SELECTED_RULE_OWNERSHIP",
		},
		{
			name:     "containing tree scope",
			scopes:   []model.OwnershipScope{{Path: "docs/harness/domain", Kind: "tree"}},
			wantCode: "AIDD_SELECTED_RULE_OWNERSHIP",
		},
		{
			name:   "separate mutable contract",
			scopes: []model.OwnershipScope{{Path: "docs/harness/contracts/user-account-attributes.json", Kind: "file"}},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := validateSelectedRuleOwnership(
				&model.TargetState{OwnershipScopes: test.scopes},
				selected,
				loaded,
				"design",
			)
			if test.wantCode == "" && err != nil {
				t.Fatalf("separate Build ownership rejected: %v", err)
			}
			if test.wantCode != "" && (err == nil || !strings.Contains(err.Error(), test.wantCode)) {
				t.Fatalf("expected %s, got %v", test.wantCode, err)
			}
		})
	}
}

func TestRequirementsAcceptsCompleteNewInventory(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	if _, err := ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	}); err != nil {
		t.Fatal(err)
	}
}

func TestRequirementsGoalGateRejectsMissingDisplayContract(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	_, goal := requirementsFixtureSources(t, issue, "new")
	var source map[string]any
	if err := json.Unmarshal(goal, &source); err != nil {
		t.Fatal(err)
	}
	display := source["display"].(map[string]any)
	display["context"].(map[string]any)["stop"] = []any{}
	goal, err = canonical.Pretty(source)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements_goal", Document: goal,
		RuleMapPath: "docs/harness/rule-map.json",
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_GOAL_CONTRACT_ORDER") {
		t.Fatalf("expected Goal contract rejection at Requirements gate, got %v", err)
	}
}

func TestRequirementsRejectsHeadingThatDoesNotMapToSectionID(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	document = mutateRequirementsSource(t, document, func(validation map[string]any) {
		sections := validation["sections"].([]any)
		sections[0].(map[string]any)["heading"] = "Section background"
	})
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENTS_HEADING") {
		t.Fatalf("expected heading rejection, got %v", err)
	}
}

func TestRequirementsRejectsLegacyPromotion(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	document := []byte(`{"schema_version":3,"kind":"requirements","workspace":"1671-checker","display":{"path":"requirements.md","preamble":"# Requirements"},"validation":{}}`)
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Workspace: "1671-checker", Kind: "requirements", Document: document,
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_LEGACY_PROMOTION") {
		t.Fatalf("expected legacy promotion rejection, got %v", err)
	}
}

func TestRequirementsBaselineUsesTheSameHeadingContract(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	sectionContract, err := requirementscontract.Load(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	issue := IssueSnapshot{Title: "Checker profile boundary", Body: fixtureIssueBody()}
	document, _ := requirementsFixtureSources(t, issue, "new")
	document = mutateRequirementsSource(t, document, func(validation map[string]any) {
		sections := validation["sections"].([]any)
		sections[0].(map[string]any)["heading"] = "not a canonical heading"
	})
	_, _, err = extractRequirementsBaseline(document, sectionContract)
	if err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENTS_HEADING") {
		t.Fatalf("expected baseline heading rejection, got %v", err)
	}
}

func TestRequirementsRejectsMatchValueMissingFromIssueEvidence(t *testing.T) {
	for _, field := range []string{"paths", "domains", "activities", "topics"} {
		t.Run(field, func(t *testing.T) {
			repoRoot := requirementsFixtureRepository(t)
			ruleMapPath := filepath.Join(repoRoot, "docs", "harness", "rule-map.json")
			var ruleMap map[string]any
			content, err := os.ReadFile(ruleMapPath)
			if err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(content, &ruleMap); err != nil {
				t.Fatal(err)
			}
			appliesTo := ruleMap["rules"].([]any)[0].(map[string]any)["applies_to"].(map[string]any)
			appliesTo[field] = []any{"checker"}
			writeFixtureJSON(t, ruleMapPath, ruleMap)

			snapshot, err := repository.Open(context.Background(), repoRoot)
			if err != nil {
				t.Fatal(err)
			}
			defer snapshot.Close()
			issue := IssueSnapshot{
				ID: "owner/repo#1671", Title: "Checker profile boundary",
				URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
				Body: fixtureIssueBody("設定を保存する。checkerは別の段落にある。"),
			}
			document, goal := requirementsFixtureSources(t, issue, "new")
			document = mutateDirectRule(t, document, func(rule map[string]any) {
				rule["issue_evidence"] = "設定を保存する。"
				rule["match"] = map[string]any{"field": field, "value": "checker"}
			})
			goal = mutateDirectRule(t, goal, func(rule map[string]any) {
				rule["issue_evidence"] = "設定を保存する。"
				rule["match"] = map[string]any{"field": field, "value": "checker"}
			})
			_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
				Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
				Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
			})
			if err == nil || !strings.Contains(err.Error(), "AIDD_RULE_MATCH_EVIDENCE") {
				t.Fatalf("expected match/evidence relationship rejection, got %v", err)
			}
		})
	}
}

func TestRequirementsAcceptsNormalizedRuleEvidenceRelationship(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody("REPO-OWNED\n\tCHECKER   PROFILEも同じ根拠である。"),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	for _, source := range []*[]byte{&document, &goal} {
		*source = mutateDirectRule(t, *source, func(rule map[string]any) {
			rule["issue_evidence"] = "repo-owned\tchecker   profile"
		})
	}
	if _, err := ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	}); err != nil {
		t.Fatal(err)
	}
}

func TestRequirementsRejectsIncompleteDirectRulesForDeclaredEvidence(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	appendFixtureRule(t, repoRoot, map[string]any{
		"id": "policy.secondary-checker", "file": "docs/rules/secondary-checker.md",
		"applies_to": map[string]any{"paths": []string{}, "domains": []string{}, "activities": []string{}, "topics": []string{"checker"}},
		"depends_on": []string{}, "overrides": []string{}, "priority": 90,
	})
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_DIRECT_RULE_COMPLETENESS") {
		t.Fatalf("expected incomplete direct-rule rejection, got %v", err)
	}
	for _, source := range []*[]byte{&document, &goal} {
		*source = mutateRequirementsSource(t, *source, func(validation map[string]any) {
			gate := validation["input_gate"].(map[string]any)
			gate["direct_rules"] = append(gate["direct_rules"].([]any), map[string]any{
				"id": "policy.secondary-checker", "issue_evidence": "repo-owned checker profile",
				"match": map[string]any{"field": "topics", "value": "checker"}, "reason": "secondary checker boundary",
			})
		})
	}
	if _, err := ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	}); err != nil {
		t.Fatalf("complete direct-rule set was rejected: %v", err)
	}
}

func TestRequirementsDoesNotSelectRulesOutsideDeclaredEvidence(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	appendFixtureRule(t, repoRoot, map[string]any{
		"id": "policy.verification", "file": "docs/rules/verification.md",
		"applies_to": map[string]any{"paths": []string{}, "domains": []string{}, "activities": []string{}, "topics": []string{"verification"}},
		"depends_on": []string{}, "overrides": []string{}, "priority": 90,
	})
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	if _, err := ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	}); err != nil {
		t.Fatalf("rule outside declared evidence was selected: %v", err)
	}
}

func TestRequirementsRejectsImplementationRuleWithoutIssueEvidencedExplicitSurface(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	ruleMapPath := filepath.Join(repoRoot, "docs", "harness", "rule-map.json")
	var ruleMap map[string]any
	content, err := os.ReadFile(ruleMapPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(content, &ruleMap); err != nil {
		t.Fatal(err)
	}
	appliesTo := ruleMap["rules"].([]any)[0].(map[string]any)["applies_to"].(map[string]any)
	appliesTo["paths"] = []any{"apps/web/**"}
	appliesTo["topics"] = []any{"checker", "web"}
	writeFixtureJSON(t, ruleMapPath, ruleMap)

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody("webの設定を保存する。checkerは別の段落にある。"),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	for _, source := range []*[]byte{&document, &goal} {
		*source = mutateDirectRule(t, *source, func(rule map[string]any) {
			rule["issue_evidence"] = "webの設定を保存する。"
			rule["match"] = map[string]any{"field": "topics", "value": "web"}
			rule["explicit_surface"] = "checker"
		})
	}
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_RULE_EXPLICIT_SURFACE_EVIDENCE") {
		t.Fatalf("expected explicit surface evidence rejection, got %v", err)
	}
}

func TestRequirementsRejectsInvalidIssueMetadata(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*IssueSnapshot)
	}{
		{name: "identity", mutate: func(issue *IssueSnapshot) { issue.ID = "invalid" }},
		{name: "url", mutate: func(issue *IssueSnapshot) { issue.URL = "https://example.invalid/issues/1671" }},
		{name: "updated at", mutate: func(issue *IssueSnapshot) { issue.UpdatedAt = "2026-08-28T09:00:00+09:00" }},
		{name: "title", mutate: func(issue *IssueSnapshot) { issue.Title = " " }},
		{name: "body encoding", mutate: func(issue *IssueSnapshot) { issue.Body = []byte{0xff} }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repoRoot := requirementsFixtureRepository(t)
			snapshot, err := repository.Open(context.Background(), repoRoot)
			if err != nil {
				t.Fatal(err)
			}
			defer snapshot.Close()
			issue := IssueSnapshot{
				ID: "owner/repo#1671", Title: "Checker profile boundary",
				URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
				Body: fixtureIssueBody(),
			}
			test.mutate(&issue)
			document, goal := requirementsFixtureSources(t, issue, "new")
			_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
				Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
				Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
			})
			if err == nil || !strings.Contains(err.Error(), "AIDD_ISSUE_") {
				t.Fatalf("expected Issue metadata rejection, got %v", err)
			}
		})
	}
}

func TestRequirementsRejectsEmptyRuleReason(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	for _, source := range []*[]byte{&document, &goal} {
		*source = mutateDirectRule(t, *source, func(rule map[string]any) { rule["reason"] = " " })
	}
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_DIRECT_RULE_TEXT") {
		t.Fatalf("expected empty reason rejection, got %v", err)
	}
}

func TestRequirementsRejectsDependencyViaWithoutDeclaredEdge(t *testing.T) {
	repoRoot := requirementsFixtureRepository(t)
	ruleMapPath := filepath.Join(repoRoot, "docs", "harness", "rule-map.json")
	content, err := os.ReadFile(ruleMapPath)
	if err != nil {
		t.Fatal(err)
	}
	var ruleMap map[string]any
	if err := json.Unmarshal(content, &ruleMap); err != nil {
		t.Fatal(err)
	}
	rules := ruleMap["rules"].([]any)
	directRule := rules[0].(map[string]any)
	directRule["depends_on"] = []any{"documentation.policy"}
	rules = append(rules, map[string]any{
		"id": "documentation.policy", "file": "docs/rules/documentation.md",
		"applies_to": map[string]any{"paths": []string{}, "domains": []string{}, "activities": []string{}, "topics": []string{"documentation"}},
		"depends_on": []string{}, "overrides": []string{}, "priority": 90,
	})
	ruleMap["rules"] = rules
	writeFixtureFile(t, filepath.Join(repoRoot, "docs", "rules", "documentation.md"), []byte("# Documentation\n"))
	writeFixtureJSON(t, ruleMapPath, ruleMap)

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	issue := IssueSnapshot{
		ID: "owner/repo#1671", Title: "Checker profile boundary",
		URL: "https://github.com/owner/repo/issues/1671", UpdatedAt: "2026-08-28T00:00:00Z",
		Body: fixtureIssueBody(),
	}
	document, goal := requirementsFixtureSources(t, issue, "new")
	for _, source := range []*[]byte{&document, &goal} {
		*source = mutateRequirementsSource(t, *source, func(validation map[string]any) {
			gate := validation["input_gate"].(map[string]any)
			gate["depends_on"] = []any{map[string]any{"id": "documentation.policy", "via": "documentation.policy"}}
		})
	}
	_, err = ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	})
	if err == nil || !strings.Contains(err.Error(), "AIDD_DEPENDENCY_VIA") {
		t.Fatalf("expected invalid dependency via rejection, got %v", err)
	}
	for _, source := range []*[]byte{&document, &goal} {
		*source = mutateRequirementsSource(t, *source, func(validation map[string]any) {
			gate := validation["input_gate"].(map[string]any)
			gate["depends_on"] = []any{map[string]any{"id": "documentation.policy", "via": "ai-driven.checker"}}
		})
	}
	if _, err := ValidateRequirements(context.Background(), snapshot, RequirementsInput{
		Issue: issue, Workspace: "1671-checker", Kind: "requirements", Document: document,
		Goal: goal, RuleMapPath: "docs/harness/rule-map.json",
	}); err != nil {
		t.Fatalf("declared dependency edge was rejected: %v", err)
	}
}

func requirementsFixtureRepository(t *testing.T) string {
	t.Helper()
	repoRoot := t.TempDir()
	runFixtureGit(t, repoRoot, "init", "-q")
	runFixtureGit(t, repoRoot, "config", "user.name", "AIDD Test")
	runFixtureGit(t, repoRoot, "config", "user.email", "aidd@example.com")
	writeFixtureFile(t, filepath.Join(repoRoot, "docs", "rules", "checker.md"), []byte("# Checker\n"))
	ruleMap := map[string]any{
		"version": 2, "description": "fixture", "resolution_order": []string{"depends_on"},
		"review_routing": map[string]any{
			"governed_paths": []string{"unrelated/**"},
			"surfaces": []any{map[string]any{
				"id": "unrelated", "paths": []string{"unrelated/**"}, "required_rules": []string{"ai-driven.checker"},
			}},
		},
		"rules": []any{map[string]any{
			"id": "ai-driven.checker", "file": "docs/rules/checker.md",
			"applies_to": map[string]any{"paths": []string{}, "domains": []string{}, "activities": []string{}, "topics": []string{"checker"}},
			"depends_on": []string{}, "overrides": []string{}, "priority": 100,
		}},
	}
	writeFixtureJSON(t, filepath.Join(repoRoot, "docs", "harness", "rule-map.json"), ruleMap)
	contractSections := make([]any, len(fixtureRequirementsSections))
	for index, section := range fixtureRequirementsSections {
		contractSections[index] = map[string]any{"id": section.ID, "headings": []string{section.Heading}}
	}
	writeFixtureJSON(t, filepath.Join(repoRoot, filepath.FromSlash(requirementscontract.DefaultPath)), map[string]any{"schema_version": 1, "sections": contractSections})
	runFixtureGit(t, repoRoot, "add", ".")
	runFixtureGit(t, repoRoot, "commit", "-qm", "fixture")
	return repoRoot
}

func appendFixtureRule(t *testing.T, repoRoot string, rule map[string]any) {
	t.Helper()
	ruleMapPath := filepath.Join(repoRoot, "docs", "harness", "rule-map.json")
	var ruleMap map[string]any
	content, err := os.ReadFile(ruleMapPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(content, &ruleMap); err != nil {
		t.Fatal(err)
	}
	ruleMap["rules"] = append(ruleMap["rules"].([]any), rule)
	writeFixtureJSON(t, ruleMapPath, ruleMap)
}

func requirementsFixtureSources(t *testing.T, issue IssueSnapshot, status string) ([]byte, []byte) {
	t.Helper()
	evidence := "repo-owned checker profile"
	sections := make([]any, len(fixtureRequirementsSections))
	transitions := make([]any, len(fixtureRequirementsSections))
	for index, definition := range fixtureRequirementsSections {
		id := definition.ID
		sectionEvidence := fmt.Sprintf("section-evidence-%02d", index+1)
		block := map[string]any{"id": id + "-body", "type": "markdown", "markdown": sectionEvidence + " を " + id + " で扱う。"}
		if id == "functional" {
			block = map[string]any{"id": id + "-requirements", "type": "requirements"}
		}
		sections[index] = map[string]any{"id": id, "heading": definition.Heading, "blocks": []any{block}}
		transitions[index] = map[string]any{"id": id, "status": status, "issue_evidence": sectionEvidence}
	}
	inputGate := map[string]any{
		"task_context": map[string]any{
			"source": "issue_body", "issue": issue.ID, "url": issue.URL,
			"updated_at": issue.UpdatedAt, "body_sha256": canonical.HashBytes(issue.Body),
		},
		"direct_rules": []any{map[string]any{
			"id": "ai-driven.checker", "issue_evidence": evidence,
			"match": map[string]any{"field": "topics", "value": "checker"}, "reason": "profile boundary",
		}},
		"depends_on": []any{},
	}
	completeness := map[string]any{
		"issue_body_sha256": canonical.HashBytes(issue.Body), "workspace": "1671-checker",
		"baseline":     map[string]any{"source": "none", "body_sha256": nil},
		"requirements": []any{map[string]any{"id": "FR-1", "status": status, "issue_evidence": evidence}},
		"sections":     transitions, "retired": []any{},
	}
	validation := map[string]any{
		"mode": "managed", "cycle_start_issue_title": issue.Title, "input_gate": inputGate,
		"completeness_gate": completeness,
		"requirements":      []any{map[string]any{"id": "FR-1", "section_id": "functional", "text": evidence + "でverificationを固定する。section-evidence-05"}},
		"sections":          sections,
	}
	document := map[string]any{
		"schema_version": 4, "kind": "requirements", "workspace": "1671-checker",
		"display": map[string]any{"path": "requirements.md", "preamble": "# Requirements"}, "validation": validation,
	}
	goal := map[string]any{
		"schema_version": 4, "kind": "requirements_goal", "workspace": "1671-checker",
		"display": map[string]any{
			"path": "goal.md", "title": "Requirements Goal", "goal": "最新Issue全体のRequirementsを完成させる。",
			"context": map[string]any{
				"body": []any{"最新Issue本文と選択済みルールからRequirementsを定義する。"},
				"constraints": []any{
					map[string]any{"id": "task-context", "text": "最新Issue本文だけをTask Context正本として扱う。"},
					map[string]any{"id": "phase-boundary", "text": "Requirements Goal内では実装しない。"},
				},
				"stop": []any{
					map[string]any{"id": "validation-failure", "text": "workspaceまたはRequirements Gateの検証が失敗した場合は停止する。"},
					map[string]any{"id": "scope-ambiguity", "text": "Issue本文から要求scopeを一意に決められない場合は停止する。"},
				},
			},
			"done": []any{
				map[string]any{"id": "complete-scope", "text": "最新Issue全体を覆うRequirementsと全要求IDを定義する。"},
				map[string]any{"id": "validated-artifact", "text": "Requirements Gateと生成成果物の同期検証を成功させる。"},
			},
		},
		"validation": map[string]any{
			"mode":                    validation["mode"],
			"cycle_start_issue_title": validation["cycle_start_issue_title"],
			"input_gate":              validation["input_gate"],
			"completeness_gate":       validation["completeness_gate"],
			"requirements":            []any{map[string]any{"id": "FR-1", "text": evidence + "でverificationを固定する。section-evidence-05"}},
			"sections":                validation["sections"],
		},
	}
	documentBytes, err := canonical.Pretty(document)
	if err != nil {
		t.Fatal(err)
	}
	goalBytes, err := canonical.Pretty(goal)
	if err != nil {
		t.Fatal(err)
	}
	return documentBytes, goalBytes
}

func mutateDirectRule(t *testing.T, content []byte, mutate func(map[string]any)) []byte {
	t.Helper()
	return mutateRequirementsSource(t, content, func(validation map[string]any) {
		gate := validation["input_gate"].(map[string]any)
		rule := gate["direct_rules"].([]any)[0].(map[string]any)
		mutate(rule)
	})
}

func mutateRequirementsSource(t *testing.T, content []byte, mutate func(map[string]any)) []byte {
	t.Helper()
	var source map[string]any
	if err := json.Unmarshal(content, &source); err != nil {
		t.Fatal(err)
	}
	mutate(source["validation"].(map[string]any))
	result, err := canonical.Pretty(source)
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func runFixtureGit(t *testing.T, repoRoot string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repoRoot}, arguments...)...)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
}

func writeFixtureJSON(t *testing.T, path string, value any) {
	t.Helper()
	content, err := canonical.Pretty(value)
	if err != nil {
		t.Fatal(err)
	}
	writeFixtureFile(t, path, content)
}

func writeFixtureFile(t *testing.T, path string, content []byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
}

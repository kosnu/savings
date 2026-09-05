package rules

import (
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
)

func currentRepositoryRules(t *testing.T) *Loaded {
	t.Helper()
	data, err := os.ReadFile("../../../../../" + DefaultPath)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := Parse(data, DefaultPath)
	if err != nil {
		t.Fatal(err)
	}
	return loaded
}

func TestRepositoryControlPlaneRouting(t *testing.T) {
	loaded := currentRepositoryRules(t)
	for _, path := range []string{
		"tools/aidd/checker/internal/protocol/new.go", "docs/ai-driven-development/contracts/new.json",
		"docs/harness/rule-map.json", "docs/harness/policies/new.md",
		"docs/adr/0001-adopt-harness-engineering.md", "docs/adr/0002-adopt-agent-rule-graph.md", "docs/adr/0003-adopt-aidd-invariant-protocol.md",
		".agents/skills/learn/SKILL.md", ".codex/hooks.json", ".codex/environments/environment.toml",
		".github/skills/code-review/SKILL.md", ".github/agents/fe-engineer.agent.md",
		".github/workflows/aidd_checker_ci.yaml", ".github/workflows/aidd_future.yaml", "AGENTS.md", "CLAUDE.md",
	} {
		t.Run(path, func(t *testing.T) {
			surfaces, required, err := ResolvePath(loaded, path)
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Contains(surfaces, "aidd-harness") {
				t.Fatalf("control plane surface missing: %v", surfaces)
			}
			for _, id := range []string{"ai-driven.workflow", "ai-driven.checker", "documentation.policy", "ai-driven.overview", "adr.harness-engineering"} {
				if !slices.Contains(required, id) {
					t.Errorf("required rule/closure %s missing: %v", id, required)
				}
			}
		})
	}
	// governedなcontrol planeを分類し忘れた場合は直接path一致だけで成功させない。
	broken := *loaded
	broken.Map.ReviewRouting.Surfaces = slices.DeleteFunc(slices.Clone(loaded.Map.ReviewRouting.Surfaces), func(s Surface) bool { return s.ID == "aidd-harness" })
	if _, _, err := ResolvePath(&broken, ".codex/hooks.json"); err == nil || !strings.Contains(err.Error(), "AIDD_GOVERNED_PATH_UNROUTED") {
		t.Fatalf("missing surface was accepted: %v", err)
	}
}

func TestRepositoryGeneralPathsKeepTheirOwnRules(t *testing.T) {
	loaded := currentRepositoryRules(t)
	cases := []struct {
		path          string
		required      []string
		allowWorkflow bool
	}{
		{"docs/architecture.md", []string{"architecture.overview", "documentation.policy", "adr.agent-rule-graph"}, false},
		{"docs/guides/new.md", []string{"documentation.policy", "adr.agent-rule-graph", "adr.harness-engineering"}, false},
		{"docs/adr/0099-product-decision.md", []string{"documentation.policy", "adr.agent-rule-graph"}, false},
		{".github/workflows/frontend_ci.yaml", []string{"policy.transaction-boundaries", "architecture.overview", "policy.git-workflow"}, false},
		{".github/workflows/deploy_production.yaml", []string{"policy.transaction-boundaries", "architecture.overview"}, false},
		{".github/CODEOWNERS", []string{"policy.git-workflow", "policy.review-feedback-classification"}, false},
		{".github/actions/setup-playwright/action.yaml", []string{"policy.git-workflow"}, false},
		{".github/ISSUE_TEMPLATE/task.md", []string{"ai-driven.issue-guidelines", "policy.issue-template-selection", "ai-driven.workflow", "ai-driven.overview", "documentation.policy"}, true},
	}
	for _, c := range cases {
		t.Run(c.path, func(t *testing.T) {
			surfaces, required, err := ResolvePath(loaded, c.path)
			if err != nil {
				t.Fatal(err)
			}
			if slices.Contains(surfaces, "aidd-harness") {
				t.Fatalf("general path became AIDD surface: %v", surfaces)
			}
			if slices.Contains(required, "ai-driven.checker") || (!c.allowWorkflow && slices.Contains(required, "ai-driven.workflow")) {
				t.Fatalf("unrelated AIDD rules: %v", required)
			}
			for _, id := range c.required {
				if !slices.Contains(required, id) {
					t.Errorf("path rule/closure %s missing: %v", id, required)
				}
			}
		})
	}
}

func TestHardRoutingKeepsLowPriorityDependenciesAndIgnoresDiscoveryMetadata(t *testing.T) {
	m := RuleMap{Version: 2, ReviewRouting: ReviewRouting{GovernedPaths: []string{"control/**"}, Surfaces: []Surface{{ID: "control", Paths: []string{"control/**"}, RequiredRules: []string{"surface"}}}}, Rules: []Rule{
		{ID: "surface", File: "docs/surface.md", Priority: 100},
		{ID: "path", File: "docs/path.md", AppliesTo: AppliesTo{Paths: []string{"**/change.json"}}, DependsOn: []string{"dependency"}, Priority: 1},
		{ID: "dependency", File: "docs/dependency.md", DependsOn: []string{"transitive"}, Priority: 0},
		{ID: "transitive", File: "docs/transitive.md", Priority: 0},
		{ID: "discovery", File: "docs/discovery.md", AppliesTo: AppliesTo{Topics: []string{"change.json"}, Domains: []string{"control"}, Activities: []string{"review"}}, Priority: 1000},
	}}
	data, err := canonical.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := Parse(data, DefaultPath)
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"control/change.json", "general/change.json"} {
		_, required, err := ResolvePath(loaded, path)
		if err != nil {
			t.Fatal(err)
		}
		for _, id := range []string{"path", "dependency", "transitive"} {
			if !slices.Contains(required, id) {
				t.Errorf("%s omitted %s: %v", path, id, required)
			}
		}
		if slices.Contains(required, "discovery") {
			t.Errorf("metadata forced rule: %v", required)
		}
		if slices.Contains(required, "surface") != strings.HasPrefix(path, "control/") {
			t.Errorf("surface union mismatch: %v", required)
		}
	}
}

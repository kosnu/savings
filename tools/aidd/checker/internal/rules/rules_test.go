package rules

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestValidatePatternRejectsMalformedGlob(t *testing.T) {
	for _, pattern := range []string{"apps/**bad/file", "apps/[bad/file", "apps//file", "apps/../file", "apps/./file", " apps/file"} {
		err := validatePattern(pattern, "fixture", 0)
		if err == nil || !strings.Contains(err.Error(), "AIDD_RULE_PATTERN") {
			t.Fatalf("pattern %q: expected structured rejection, got %v", pattern, err)
		}
	}
}

func TestLoadRejectsIncompleteRuleMapContracts(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*RuleMap)
		code   string
	}{
		{name: "governed paths", mutate: func(value *RuleMap) { value.ReviewRouting.GovernedPaths = nil }, code: "AIDD_GOVERNED_PATHS_EMPTY"},
		{name: "surfaces", mutate: func(value *RuleMap) { value.ReviewRouting.Surfaces = nil }, code: "AIDD_SURFACES_EMPTY"},
		{name: "surface paths", mutate: func(value *RuleMap) { value.ReviewRouting.Surfaces[0].Paths = nil }, code: "AIDD_SURFACE_PATHS_EMPTY"},
		{name: "surface rules", mutate: func(value *RuleMap) { value.ReviewRouting.Surfaces[0].RequiredRules = nil }, code: "AIDD_SURFACE_RULES_EMPTY"},
		{name: "duplicate surface rule", mutate: func(value *RuleMap) { value.ReviewRouting.Surfaces[0].RequiredRules = []string{"checker", "checker"} }, code: "AIDD_SURFACE_RULE_DUPLICATE"},
		{name: "blank applicability", mutate: func(value *RuleMap) { value.Rules[0].AppliesTo.Topics = []string{" "} }, code: "AIDD_RULE_APPLIES_TO"},
		{name: "blank dependency", mutate: func(value *RuleMap) { value.Rules[0].DependsOn = []string{" "} }, code: "AIDD_RULE_DEPENDENCY"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repoRoot := t.TempDir()
			if output, err := exec.Command("git", "init", "--quiet", repoRoot).CombinedOutput(); err != nil {
				t.Fatalf("git init: %v: %s", err, output)
			}
			value := RuleMap{
				Version: 2,
				ReviewRouting: ReviewRouting{
					GovernedPaths: []string{"apps/**"},
					Surfaces:      []Surface{{ID: "checker", Paths: []string{"apps/**"}, RequiredRules: []string{"checker"}}},
				},
				Rules: []Rule{{
					ID: "checker", File: "docs/checker.md", AppliesTo: AppliesTo{Topics: []string{"checker"}},
					DependsOn: []string{}, Overrides: []string{},
				}},
			}
			test.mutate(&value)
			content, err := canonical.Pretty(value)
			if err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(repoRoot, "docs", "harness", "rule-map.json")
			if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(path, content, 0o644); err != nil {
				t.Fatal(err)
			}
			snapshot, err := repository.Open(context.Background(), repoRoot)
			if err != nil {
				t.Fatal(err)
			}
			defer snapshot.Close()
			if _, err := Load(snapshot, "docs/harness/rule-map.json"); err == nil || !strings.Contains(err.Error(), test.code) {
				t.Fatalf("expected %s, got %v", test.code, err)
			}
		})
	}
}

func TestRepositoryRuleMapLoads(t *testing.T) {
	workingDirectory, err := filepath.Abs(".")
	if err != nil {
		t.Fatal(err)
	}
	repoRoot := filepath.Clean(filepath.Join(workingDirectory, "../../../../.."))
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := Load(snapshot, "docs/harness/rule-map.json")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := loaded.ByID["ai-driven.checker"]; !ok {
		t.Fatal("AIDD checker rule is missing")
	}
}

func TestMatchSegmentsAllowsDoubleStarToMatchZeroSegments(t *testing.T) {
	if !matchSegments([]string{"apps", "**", "file.ts"}, []string{"apps", "file.ts"}) {
		t.Fatal("double-star must match zero path segments")
	}
}

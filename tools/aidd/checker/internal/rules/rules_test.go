package rules

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestValidatePatternRejectsMalformedGlob(t *testing.T) {
	for _, pattern := range []string{"apps/**bad/file", "apps/[bad/file", "apps//file", "apps/../file"} {
		err := validatePattern(pattern, "fixture", 0)
		if err == nil || !strings.Contains(err.Error(), "AIDD_RULE_PATTERN") {
			t.Fatalf("pattern %q: expected structured rejection, got %v", pattern, err)
		}
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

package requirementscontract

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestRepositoryRequirementsSectionContractLoadsCanonicalAliases(t *testing.T) {
	workingDirectory, err := filepath.Abs(".")
	if err != nil {
		t.Fatal(err)
	}
	repoRoot := filepath.Clean(filepath.Join(workingDirectory, "../../../../.."))
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	resolved, err := Load(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if len(resolved.IDs) != 9 {
		t.Fatalf("section count = %d, want 9", len(resolved.IDs))
	}
	for _, match := range []struct {
		ID      string
		Heading string
	}{
		{"background", "Background / Current State"},
		{"non-functional", "非機能要件と制約"},
		{"qa", "Ｑ＆Ａ"},
	} {
		if !resolved.MatchHeading(match.ID, match.Heading) {
			t.Fatalf("heading %q did not map to %q", match.Heading, match.ID)
		}
	}
	if resolved.MatchHeading("background", "対象ユーザー") {
		t.Fatal("heading mapped to the wrong section ID")
	}
}

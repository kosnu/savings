package workspace

import (
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestNormalizeTitleUsesNFKCAndCaseFold(t *testing.T) {
	actual := normalizeTitle(" ＡＩＤＤ Straße　")
	if actual != "aidd strasse" {
		t.Fatalf("unexpected normalized title: %q", actual)
	}
}

func TestResolveRejectsPartialIssueIdentity(t *testing.T) {
	_, err := Resolve(&repository.Snapshot{}, "not-an-owner-repo#1671", "title")
	if err == nil || !strings.Contains(err.Error(), "AIDD_ISSUE_ID") {
		t.Fatalf("expected exact Issue identity rejection, got %v", err)
	}
}

package pathcontract

import (
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

func TestValidateRelativePathRejectsTraversalAndMetadata(t *testing.T) {
	for _, path := range []string{"../outside", "inside/../../outside", "/absolute", "nested\\file"} {
		t.Run(path, func(t *testing.T) {
			if _, err := ValidateRelativePath(path); err == nil {
				t.Fatalf("ValidateRelativePath(%q) succeeded", path)
			}
		})
	}
}

func TestValidateRelativePathRejectsEveryVCSMetadataSegment(t *testing.T) {
	for _, path := range []string{".git/config", "nested/.git/config", ".hg/store/data", "nested/.svn/wc.db"} {
		t.Run(path, func(t *testing.T) {
			_, err := ValidateRelativePath(path)
			item, ok := err.(*diagnostic.Diagnostic)
			if !ok || item.Code != "AIDD_PATH_VCS_METADATA" {
				t.Fatalf("ValidateRelativePath(%q) error = %#v, want AIDD_PATH_VCS_METADATA", path, err)
			}
		})
	}
}

func TestValidateRelativePathAllowsVCSLikeNames(t *testing.T) {
	for _, path := range []string{".github/workflows/check.yml", "docs/.gitignore", "nested/.svn-backup/file"} {
		if _, err := ValidateRelativePath(path); err != nil {
			t.Fatalf("ValidateRelativePath(%q) failed: %v", path, err)
		}
	}
}

func TestValidateWorkspaceName(t *testing.T) {
	for _, workspace := range []string{"1671-checker", "a"} {
		if err := ValidateWorkspaceName(workspace); err != nil {
			t.Fatalf("ValidateWorkspaceName(%q) failed: %v", workspace, err)
		}
	}
	for _, workspace := range []string{"", "Checker", "-checker", "checker_1"} {
		if err := ValidateWorkspaceName(workspace); err == nil {
			t.Fatalf("ValidateWorkspaceName(%q) succeeded", workspace)
		}
	}
}

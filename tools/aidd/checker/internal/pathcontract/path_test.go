package pathcontract

import "testing"

func TestValidateRelativePathRejectsTraversalAndMetadata(t *testing.T) {
	for _, path := range []string{"../outside", "inside/../../outside", "/absolute", ".git/config", "nested\\file"} {
		t.Run(path, func(t *testing.T) {
			if _, err := ValidateRelativePath(path); err == nil {
				t.Fatalf("ValidateRelativePath(%q) succeeded", path)
			}
		})
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

package pathcontract

import (
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

var workspaceNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

// ValidateRelativePathはfilesystemへ触れず、repository-relative pathの字句契約だけを検証する。
func ValidateRelativePath(path string) (string, error) {
	if path == "" || !utf8.ValidString(path) || strings.Contains(path, "\\") || filepath.IsAbs(path) {
		return "", diagnostic.New("AIDD_PATH_INVALID", path, "repository", "path must be a normalized UTF-8 repository-relative path", nil, path)
	}
	for _, character := range path {
		if unicode.IsControl(character) {
			return "", diagnostic.New("AIDD_PATH_CONTROL", path, "repository", "path must not contain control characters", nil, path)
		}
	}
	cleaned := filepath.ToSlash(filepath.Clean(path))
	if cleaned != path || cleaned == "." || strings.HasPrefix(cleaned, "../") {
		return "", diagnostic.New("AIDD_PATH_NONCANONICAL", path, "repository", "path is not canonical", cleaned, path)
	}
	for _, part := range strings.Split(path, "/") {
		if part == ".git" {
			return "", diagnostic.New("AIDD_PATH_GIT_METADATA", path, "repository", "path must not enter Git metadata", nil, path)
		}
	}
	return path, nil
}

// ValidateWorkspaceNameはfilesystemへ触れず、workspace identityの字句契約だけを検証する。
func ValidateWorkspaceName(workspace string) error {
	if !workspaceNamePattern.MatchString(workspace) {
		return diagnostic.New("AIDD_WORKSPACE", workspace, "workspace", "workspace must use lowercase ASCII kebab-case", "lowercase ASCII kebab-case", workspace)
	}
	return nil
}

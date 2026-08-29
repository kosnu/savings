package workspace

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"golang.org/x/text/cases"
	"golang.org/x/text/unicode/norm"
)

var (
	issuePattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#([1-9][0-9]*)$`)
)

func Resolve(ctx context.Context, snapshot *repository.Snapshot, issue, title string) (string, error) {
	match := issuePattern.FindStringSubmatch(issue)
	if match == nil {
		return "", diagnostic.New("AIDD_ISSUE_ID", "issue", "workspace", "Issue identity must end in #number", "owner/repo#number", issue)
	}
	number := match[1]
	const root = "docs/ai-driven-development/workspaces"
	exists, err := snapshot.Exists(root)
	if err != nil {
		return "", err
	}
	entries := []os.DirEntry{}
	if exists {
		entries, err = snapshot.ReadDir(root)
		if err != nil {
			return "", err
		}
	}
	existingSet := map[string]struct{}{}
	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), number+"-") {
			existingSet[entry.Name()] = struct{}{}
		}
	}
	established, err := gitHeadWorkspaceNames(ctx, snapshot, number)
	if err != nil {
		return "", err
	}
	for name := range established {
		existingSet[name] = struct{}{}
	}
	existing := make([]string, 0, len(existingSet))
	for name := range existingSet {
		if err := pathcontract.ValidateWorkspaceName(name); err != nil {
			return "", err
		}
		existing = append(existing, name)
	}
	sort.Strings(existing)
	if len(existing) > 1 {
		return "", diagnostic.New("AIDD_WORKSPACE_AMBIGUOUS", "workspace", "workspace", "Issue owns more than one workspace", "exactly one", existing)
	}
	if len(existing) == 1 {
		if _, tracked := established[existing[0]]; tracked {
			return existing[0], nil
		}
		expected, err := deriveName(number, title)
		if err != nil {
			return "", err
		}
		if existing[0] != expected {
			return "", diagnostic.New("AIDD_WORKSPACE_IDENTITY", "workspace", "workspace", "untracked workspace must use the canonical Issue-derived name", expected, existing[0])
		}
		return existing[0], nil
	}
	return deriveName(number, title)
}

func deriveName(number, title string) (string, error) {
	normalized := normalizeTitle(title)
	if normalized == "" {
		return "", diagnostic.New("AIDD_ISSUE_TITLE", "issue_title", "workspace", "Issue title must be non-empty after normalization", "non-empty title", title)
	}
	words := []string{}
	var current strings.Builder
	for _, character := range normalized {
		if character >= 'a' && character <= 'z' || character >= '0' && character <= '9' {
			current.WriteRune(character)
			continue
		}
		if current.Len() > 0 {
			words = append(words, current.String())
			current.Reset()
		}
	}
	if current.Len() > 0 {
		words = append(words, current.String())
	}
	slug := strings.Join(words, "-")
	if slug == "" {
		slug = "issue"
	}
	if len(slug) > 48 {
		slug = strings.Trim(slug[:48], "-")
	}
	digest := sha256.Sum256([]byte(normalized))
	return number + "-" + slug + "-" + hex.EncodeToString(digest[:])[:12], nil
}

func gitHeadWorkspaceNames(ctx context.Context, snapshot *repository.Snapshot, number string) (map[string]struct{}, error) {
	const root = "docs/ai-driven-development/workspaces"
	output, err := snapshot.Git(ctx, "ls-tree", "-r", "--name-only", "-z", "HEAD", "--", root)
	if err != nil {
		return nil, err
	}
	if len(output) > 0 && output[len(output)-1] != 0 {
		return nil, diagnostic.New("AIDD_WORKSPACE_GIT", "workspace", "workspace", "Git workspace listing must use NUL-terminated records", "NUL-terminated paths", string(output))
	}
	result := map[string]struct{}{}
	prefix := root + "/"
	issuePrefix := number + "-"
	for _, raw := range bytes.Split(output, []byte{0}) {
		if len(raw) == 0 {
			continue
		}
		if !utf8.Valid(raw) {
			return nil, diagnostic.New("AIDD_WORKSPACE_GIT", "workspace", "workspace", "Git workspace path must be UTF-8", "UTF-8 path", raw)
		}
		path, pathErr := pathcontract.ValidateRelativePath(string(raw))
		if pathErr != nil {
			return nil, pathErr
		}
		if !strings.HasPrefix(path, prefix) {
			continue
		}
		name := strings.SplitN(strings.TrimPrefix(path, prefix), "/", 2)[0]
		if strings.HasPrefix(name, issuePrefix) {
			result[name] = struct{}{}
		}
	}
	return result, nil
}

func normalizeTitle(title string) string {
	normalized := cases.Fold().String(norm.NFKC.String(title))
	return strings.Join(strings.Fields(normalized), " ")
}

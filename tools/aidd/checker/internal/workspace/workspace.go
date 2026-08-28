package workspace

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"regexp"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"golang.org/x/text/cases"
	"golang.org/x/text/unicode/norm"
)

var issuePattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#([1-9][0-9]*)$`)

func Resolve(snapshot *repository.Snapshot, issue, title string) (string, error) {
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
	existing := []string{}
	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), number+"-") {
			existing = append(existing, entry.Name())
		}
	}
	sort.Strings(existing)
	if len(existing) > 1 {
		return "", diagnostic.New("AIDD_WORKSPACE_AMBIGUOUS", "workspace", "workspace", "Issue owns more than one workspace", "exactly one", existing)
	}
	if len(existing) == 1 {
		return existing[0], nil
	}
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

func normalizeTitle(title string) string {
	normalized := cases.Fold().String(norm.NFKC.String(title))
	return strings.Join(strings.Fields(normalized), " ")
}

package repository

import (
	"context"
	"os"
	"os/exec"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

// newGitCommandは親processのGit repository選択を継承せず、指定rootだけを正本として使う。
// overridesはchecker自身が所有する値だけに限定する。
func newGitCommand(ctx context.Context, root string, overrides []string, arguments ...string) *exec.Cmd {
	commandArguments := append([]string{"-C", root}, arguments...)
	command := exec.CommandContext(ctx, "git", commandArguments...)
	command.Env = CanonicalGitEnvironment(os.Environ(), overrides)
	return command
}

// CurrentBranchは親processのGit環境を継承せず、指定worktreeのbranch名だけを返す。
func CurrentBranch(ctx context.Context, root string) (string, error) {
	output, err := newGitCommand(ctx, root, nil, "symbolic-ref", "--quiet", "--short", "HEAD").Output()
	if err != nil {
		return "", diagnostic.New("AIDD_GIT_BRANCH", "branch", "repository", "current branch cannot be resolved", "attached branch", err.Error())
	}
	branch := strings.TrimSpace(string(output))
	if branch == "" {
		return "", diagnostic.New("AIDD_GIT_BRANCH", "branch", "repository", "current branch cannot be empty", "non-empty branch", branch)
	}
	return branch, nil
}

// CanonicalGitEnvironmentは親processのGit固有設定を除去し、checker所有のoverrideだけを加える。
func CanonicalGitEnvironment(source, overrides []string) []string {
	result := make([]string, 0, len(source)+len(overrides)+2)
	for _, entry := range source {
		key, _, found := strings.Cut(entry, "=")
		if found && len(key) >= 4 && strings.EqualFold(key[:4], "GIT_") {
			continue
		}
		result = append(result, entry)
	}
	result = append(result, "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL="+os.DevNull)
	return append(result, overrides...)
}

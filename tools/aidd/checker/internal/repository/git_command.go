package repository

import (
	"context"
	"os"
	"os/exec"
	"strings"
)

// newGitCommandは親processのGit repository選択を継承せず、指定rootだけを正本として使う。
// overridesはchecker自身が所有する値だけに限定する。
func newGitCommand(ctx context.Context, root string, overrides []string, arguments ...string) *exec.Cmd {
	commandArguments := append([]string{"-C", root}, arguments...)
	command := exec.CommandContext(ctx, "git", commandArguments...)
	command.Env = canonicalGitEnvironment(os.Environ(), overrides)
	return command
}

func canonicalGitEnvironment(source, overrides []string) []string {
	result := make([]string, 0, len(source)+len(overrides))
	for _, entry := range source {
		key, _, found := strings.Cut(entry, "=")
		if found && len(key) >= 4 && strings.EqualFold(key[:4], "GIT_") {
			continue
		}
		result = append(result, entry)
	}
	return append(result, overrides...)
}

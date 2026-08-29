package repository

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

func (snapshot *Snapshot) GitIndexIdentity(ctx context.Context) (string, error) {
	pathBytes, err := snapshot.Git(ctx, "rev-parse", "--git-path", "index")
	if err != nil {
		return "", err
	}
	path := strings.TrimSuffix(string(pathBytes), "\n")
	if path == "" || strings.ContainsRune(path, '\x00') {
		return "", diagnostic.New("AIDD_GIT_STATE_INDEX_PATH", "index", "repository", "verification Git index path is invalid", "non-empty path without NUL", path)
	}
	if !filepath.IsAbs(path) {
		path = filepath.Join(snapshot.Root, path)
	}
	before, err := os.Lstat(path)
	if err != nil {
		return "", diagnostic.New("AIDD_GIT_STATE_INDEX", "index", "repository", "verification Git index cannot be inspected", "regular Git index file", err.Error())
	}
	if !before.Mode().IsRegular() {
		return "", diagnostic.New("AIDD_GIT_STATE_INDEX", "index", "repository", "verification Git index must be a regular file", "regular Git index file", before.Mode().String())
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", diagnostic.New("AIDD_GIT_STATE_INDEX", "index", "repository", "verification Git index cannot be read", "stable Git index bytes", err.Error())
	}
	after, err := os.Lstat(path)
	if err != nil || !os.SameFile(before, after) || before.Size() != after.Size() || !before.ModTime().Equal(after.ModTime()) || before.Mode() != after.Mode() {
		actual := "index changed while read"
		if err != nil {
			actual = err.Error()
		}
		return "", diagnostic.New("AIDD_GIT_STATE_INDEX_DRIFT", "index", "repository", "verification Git index changed while its bytes were captured", "stable Git index file", actual)
	}
	digest := sha256.Sum256(content)
	return hex.EncodeToString(digest[:]), nil
}

// GitIndexWorktreeDiffは実indexを変更せず、worktree差分を隠すindex flagを除いた
// 一時indexとの比較結果を返す。
func (snapshot *Snapshot) GitIndexWorktreeDiff(ctx context.Context) ([]byte, error) {
	entries, err := snapshot.Git(ctx, "ls-files", "--stage", "-z")
	if err != nil {
		return nil, err
	}
	temporaryDirectory, err := os.MkdirTemp("", "aidd-checker-index-")
	if err != nil {
		return nil, diagnostic.New("AIDD_GIT_TEMP_INDEX", "index", "repository", "temporary Git index directory cannot be created", "writable temporary directory", err.Error())
	}
	defer os.RemoveAll(temporaryDirectory)
	temporaryIndex := filepath.Join(temporaryDirectory, "index")

	if _, err := snapshot.gitWithIndex(ctx, temporaryIndex, nil, "read-tree", "--empty"); err != nil {
		return nil, err
	}
	if len(entries) > 0 {
		if _, err := snapshot.gitWithIndex(ctx, temporaryIndex, entries, "update-index", "-z", "--index-info"); err != nil {
			return nil, err
		}
	}
	return snapshot.gitWithIndex(ctx, temporaryIndex, nil, "-c", "core.fileMode=true", "diff", "--name-status", "-z", "--find-renames", "--ignore-submodules=none", "--")
}

func (snapshot *Snapshot) gitWithIndex(ctx context.Context, indexPath string, input []byte, arguments ...string) ([]byte, error) {
	commandArguments := append([]string{"-C", snapshot.Root}, arguments...)
	command := exec.CommandContext(ctx, "git", commandArguments...)
	command.Env = append(os.Environ(), "GIT_INDEX_FILE="+indexPath)
	if input != nil {
		command.Stdin = bytes.NewReader(input)
	}
	output, err := command.Output()
	if err != nil {
		actual := err.Error()
		if exitErr, ok := err.(*exec.ExitError); ok && len(exitErr.Stderr) > 0 {
			actual = string(exitErr.Stderr)
		}
		return nil, diagnostic.New("AIDD_GIT", strings.Join(arguments, " "), "git", "Git command with temporary index failed", "exit 0", actual)
	}
	return output, nil
}

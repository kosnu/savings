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
	path, err := snapshot.gitIndexPath(ctx)
	if err != nil {
		return "", err
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

func (snapshot *Snapshot) gitIndexPath(ctx context.Context) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if snapshot.canonicalGitIndexPath == "" {
		return "", diagnostic.New("AIDD_GIT_STATE_INDEX_PATH", "index", "repository", "canonical Git index path was not fixed when the repository snapshot opened", "fixed Git worktree index path", nil)
	}
	return snapshot.canonicalGitIndexPath, nil
}

func normalizeGitIndexPath(root string, pathBytes []byte) (string, error) {
	path := strings.TrimSuffix(strings.TrimSuffix(string(pathBytes), "\n"), "\r")
	if path == "" || strings.ContainsRune(path, '\x00') {
		return "", diagnostic.New("AIDD_GIT_STATE_INDEX_PATH", "index", "repository", "verification Git index path is invalid", "non-empty path without NUL", path)
	}
	if !filepath.IsAbs(path) {
		path = filepath.Join(root, path)
	}
	return filepath.Clean(path), nil
}

// PinGitIndexはsnapshotが最初に観測したraw index bytesのidentityを固定する。
func (snapshot *Snapshot) PinGitIndex(ctx context.Context) error {
	current, err := snapshot.GitIndexIdentity(ctx)
	if err != nil {
		return err
	}
	if snapshot.gitIndexSHA256 == "" {
		snapshot.gitIndexSHA256 = current
		return nil
	}
	if current != snapshot.gitIndexSHA256 {
		return diagnostic.New("AIDD_GIT_STATE_INDEX_DRIFT", "index", "repository", "Git index changed after its snapshot identity was fixed", snapshot.gitIndexSHA256, current)
	}
	return nil
}

func (snapshot *Snapshot) AssertGitIndexUnchanged(ctx context.Context) error {
	if snapshot.gitIndexSHA256 == "" {
		return diagnostic.New("AIDD_GIT_STATE_INDEX_UNPINNED", "index", "repository", "Git index identity must be fixed before post-Design validation", "pinned raw index identity", nil)
	}
	return snapshot.PinGitIndex(ctx)
}

// WithStableGitStateはGit writerを標準index lockで排他し、固定済みHEADとindexの再照合から
// action完了後の再照合までを同じcritical sectionで実行する。
func (snapshot *Snapshot) WithStableGitState(ctx context.Context, action func() error) (resultErr error) {
	indexPath, err := snapshot.gitIndexPath(ctx)
	if err != nil {
		return err
	}
	lockPath := indexPath + ".lock"
	lock, err := os.OpenFile(lockPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return diagnostic.New("AIDD_GIT_STATE_INDEX_LOCK", "index", "repository", "Git index cannot be locked while a canonical Build output is written", "available Git index lock", err.Error())
	}
	defer func() {
		closeErr := lock.Close()
		removeErr := os.Remove(lockPath)
		if closeErr != nil || removeErr != nil {
			details := []string{}
			if closeErr != nil {
				details = append(details, "close: "+closeErr.Error())
			}
			if removeErr != nil {
				details = append(details, "remove: "+removeErr.Error())
			}
			resultErr = diagnostic.New("AIDD_GIT_STATE_INDEX_UNLOCK", "index", "repository", "Git index lock could not be released after canonical Build output", "closed and removed index lock", strings.Join(details, "; "))
		}
	}()
	if err := snapshot.AssertGitIndexUnchanged(ctx); err != nil {
		return err
	}
	if snapshot.gitHead == "" {
		return diagnostic.New("AIDD_GIT_HEAD_UNPINNED", "HEAD", "repository", "Git HEAD identity must be fixed before a canonical Build output is written", "pinned Git HEAD identity", nil)
	}
	if err := snapshot.AssertGitHeadUnchanged(ctx); err != nil {
		return err
	}
	if err := action(); err != nil {
		return err
	}
	if err := snapshot.AssertGitIndexUnchanged(ctx); err != nil {
		return err
	}
	return snapshot.AssertGitHeadUnchanged(ctx)
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
	command := newGitCommand(ctx, snapshot.Root, []string{"GIT_INDEX_FILE=" + indexPath}, arguments...)
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

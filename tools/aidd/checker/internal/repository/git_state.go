package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
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

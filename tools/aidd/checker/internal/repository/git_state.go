package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

// StagedTreeIdentityはindexのcacheやvisibility flagではなく、stage entryの
// mode・blob ID・stage・pathをGit indexの意味上のidentityとして返す。
func (snapshot *Snapshot) StagedTreeIdentity(ctx context.Context) (string, error) {
	entries, err := snapshot.Git(ctx, "ls-files", "--stage", "-z")
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(entries)
	return hex.EncodeToString(digest[:]), nil
}

func (snapshot *Snapshot) AssertNoStagedChanges(ctx context.Context, baseline string) error {
	if len(baseline) != 40 {
		return diagnostic.New("AIDD_BUILD_BASELINE", "build_baseline.head", "repository", "Build staged-tree validation requires a full Git commit ID", "40 hexadecimal characters", baseline)
	}
	output, err := snapshot.Git(ctx,
		"-c", "core.fileMode=true",
		"diff", "--cached", "--no-ext-diff", "--name-status", "-z", "--no-renames", "--ignore-submodules=none", baseline, "--",
	)
	if err != nil {
		return err
	}
	if len(output) != 0 {
		return diagnostic.New("AIDD_BUILD_STAGED_STATE", "index", "repository", "Build / Verify must not stage repository changes", "no staged diff against the receipt HEAD", "staged diff present")
	}
	return nil
}

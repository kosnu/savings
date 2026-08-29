package state

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

var (
	untrackedDigestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	untrackedModePattern   = regexp.MustCompile(`^0[0-7]{3}$`)
)

type File struct {
	Path    string `json:"path"`
	Type    string `json:"type"`
	GitMode string `json:"git_mode"`
	SHA256  string `json:"sha256"`
}

type Manifest struct {
	Version           int    `json:"version"`
	TargetStateSHA256 string `json:"target_state_sha256"`
	Files             []File `json:"files"`
}

type RepositoryGitState struct {
	Version       int    `json:"version"`
	HeadCommit    string `json:"head_commit"`
	HeadReference string `json:"head_reference"`
	IndexSHA256   string `json:"index_sha256"`
}

func UntrackedInventory(ctx context.Context, snapshot *repository.Snapshot, excluded map[string]struct{}) ([]model.UntrackedEntry, error) {
	paths, err := untrackedPaths(ctx, snapshot, excluded)
	if err != nil {
		return nil, err
	}
	result := make([]model.UntrackedEntry, 0, len(paths))
	for _, path := range paths {
		identity, identityErr := snapshot.ObserveWorktreeIdentity(path)
		if identityErr != nil {
			return nil, identityErr
		}
		result = append(result, model.UntrackedEntry{Path: identity.Path, Type: identity.Type, Mode: identity.Mode, SHA256: identity.SHA256})
	}
	currentPaths, err := untrackedPaths(ctx, snapshot, excluded)
	if err != nil {
		return nil, err
	}
	if !equal(paths, currentPaths) {
		return nil, diagnostic.New("AIDD_UNTRACKED_DRIFT", "untracked_baseline", "repository", "non-ignored untracked path inventory changed while it was captured", paths, currentPaths)
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return nil, err
	}
	return result, nil
}

func AssertUntrackedPaths(ctx context.Context, snapshot *repository.Snapshot, expected []model.UntrackedEntry, excluded map[string]struct{}) error {
	paths, err := untrackedPaths(ctx, snapshot, excluded)
	if err != nil {
		return err
	}
	expectedPaths := make([]string, len(expected))
	for index, entry := range expected {
		expectedPaths[index] = entry.Path
	}
	if !equal(expectedPaths, paths) {
		return diagnostic.New("AIDD_UNTRACKED_DRIFT", "untracked_baseline", "repository", "non-ignored untracked path inventory changed before Design completion was written", expectedPaths, paths)
	}
	return nil
}

func ValidateUntrackedBaseline(entries []model.UntrackedEntry) error {
	previous := ""
	for index, entry := range entries {
		if _, err := pathcontract.ValidateRelativePath(entry.Path); err != nil {
			return diagnostic.New("AIDD_UNTRACKED_BASELINE_PATH", "untracked_baseline.value", "design_completion", "untracked baseline path is invalid", "canonical repository-relative path", entry.Path)
		}
		if index > 0 && entry.Path <= previous {
			return diagnostic.New("AIDD_UNTRACKED_BASELINE_ORDER", "untracked_baseline.value", "design_completion", "untracked baseline paths must be unique and sorted", "strict path order", entry.Path)
		}
		if entry.Type != "regular" && entry.Type != "symlink" {
			return diagnostic.New("AIDD_UNTRACKED_BASELINE_TYPE", entry.Path, "design_completion", "untracked baseline entry type is unsupported", []string{"regular", "symlink"}, entry.Type)
		}
		if !untrackedModePattern.MatchString(entry.Mode) {
			return diagnostic.New("AIDD_UNTRACKED_BASELINE_MODE", entry.Path, "design_completion", "untracked baseline mode must use four octal permission digits", "0xxx", entry.Mode)
		}
		if !untrackedDigestPattern.MatchString(entry.SHA256) {
			return diagnostic.New("AIDD_UNTRACKED_BASELINE_HASH", entry.Path, "design_completion", "untracked baseline identity must use a lowercase SHA-256 digest", "64 lowercase hexadecimal characters", entry.SHA256)
		}
		previous = entry.Path
	}
	return nil
}

func RepositoryGitStateHash(ctx context.Context, snapshot *repository.Snapshot) (string, error) {
	headBytes, err := snapshot.Git(ctx, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return "", err
	}
	headCommit := strings.TrimSpace(string(headBytes))
	if len(headCommit) != 40 {
		return "", diagnostic.New("AIDD_GIT_STATE_HEAD", "HEAD", "repository", "verification Git state requires a full commit ID", "40 hexadecimal characters", headCommit)
	}
	headReferenceBytes, err := snapshot.Git(ctx, "rev-parse", "--symbolic-full-name", "HEAD")
	if err != nil {
		return "", err
	}
	headReference := strings.TrimSpace(string(headReferenceBytes))
	if headReference == "" {
		return "", diagnostic.New("AIDD_GIT_STATE_HEAD", "HEAD", "repository", "verification Git state requires a symbolic HEAD identity or detached HEAD marker", "refs/... or HEAD", headReference)
	}
	indexSHA256, err := snapshot.GitIndexIdentity(ctx)
	if err != nil {
		return "", err
	}
	return canonical.Hash(RepositoryGitState{Version: 2, HeadCommit: headCommit, HeadReference: headReference, IndexSHA256: indexSHA256})
}

func untrackedPaths(ctx context.Context, snapshot *repository.Snapshot, excluded map[string]struct{}) ([]string, error) {
	output, err := snapshot.Git(ctx, "ls-files", "--others", "--exclude-standard", "-z")
	if err != nil {
		return nil, err
	}
	result := []string{}
	for _, raw := range bytes.Split(output, []byte{0}) {
		if len(raw) == 0 {
			continue
		}
		path := string(raw)
		if _, err := pathcontract.ValidateRelativePath(path); err != nil {
			return nil, err
		}
		if _, skip := excluded[path]; skip {
			continue
		}
		result = append(result, path)
	}
	sort.Strings(result)
	return result, nil
}

func Inventory(snapshot *repository.Snapshot, target *model.TargetState) ([]string, error) {
	paths := map[string]struct{}{}
	for _, scope := range target.OwnershipScopes {
		mode, exists, err := snapshot.Mode(scope.Path)
		if err != nil {
			return nil, err
		}
		if !exists {
			continue
		}
		if scope.Kind == "file" {
			if !mode.IsRegular() {
				return nil, diagnostic.New("AIDD_OWNED_FILE_TYPE", scope.Path, "target_state", "file ownership scope must be a regular file", "regular file", mode.String())
			}
			paths[scope.Path] = struct{}{}
			continue
		}
		if !mode.IsDir() {
			return nil, diagnostic.New("AIDD_OWNED_TREE_TYPE", scope.Path, "target_state", "tree ownership scope must be a directory", "directory", mode.String())
		}
		files, err := snapshot.RegularFiles(scope.Path)
		if err != nil {
			return nil, err
		}
		for _, path := range files {
			paths[path] = struct{}{}
		}
	}
	result := make([]string, 0, len(paths))
	for path := range paths {
		result = append(result, path)
	}
	sort.Strings(result)
	return result, nil
}

func ValidateFinal(snapshot *repository.Snapshot, target *model.TargetState) ([]string, error) {
	inventory, err := Inventory(snapshot, target)
	if err != nil {
		return nil, err
	}
	expectedSet := map[string]struct{}{}
	for _, representation := range target.Representations {
		expectedSet[representation.Path] = struct{}{}
	}
	expected := make([]string, 0, len(expectedSet))
	for path := range expectedSet {
		expected = append(expected, path)
	}
	sort.Strings(expected)
	if !equal(inventory, expected) {
		return nil, diagnostic.New("AIDD_FINAL_INVENTORY", "representations", "target_state", "owned final-state files must exactly match representation paths", expected, inventory)
	}
	return inventory, nil
}

func BuildManifest(snapshot *repository.Snapshot, target *model.TargetState) (*Manifest, error) {
	inventory, err := ValidateFinal(snapshot, target)
	if err != nil {
		return nil, err
	}
	targetHash, err := canonical.Hash(target)
	if err != nil {
		return nil, err
	}
	manifest := &Manifest{Version: 1, TargetStateSHA256: targetHash}
	for _, path := range inventory {
		content, readErr := snapshot.Read(path)
		if readErr != nil {
			return nil, diagnostic.New("AIDD_FINAL_READ", path, "target_state", "owned file cannot be read", nil, readErr.Error())
		}
		modeValue, exists, statErr := snapshot.Mode(path)
		if statErr != nil {
			return nil, diagnostic.New("AIDD_FINAL_STAT", path, "target_state", "owned file cannot be inspected", nil, statErr.Error())
		}
		if !exists || !modeValue.IsRegular() {
			return nil, diagnostic.New("AIDD_FINAL_STAT", path, "target_state", "owned file must remain a regular file", "regular file", modeValue.String())
		}
		digest := sha256.Sum256(content)
		mode := "100644"
		if modeValue&0o100 != 0 {
			mode = "100755"
		}
		manifest.Files = append(manifest.Files, File{Path: path, Type: "regular", GitMode: mode, SHA256: hex.EncodeToString(digest[:])})
	}
	return manifest, nil
}

func FinalHash(snapshot *repository.Snapshot, target *model.TargetState) (string, error) {
	manifest, err := BuildManifest(snapshot, target)
	if err != nil {
		return "", err
	}
	return canonical.Hash(manifest)
}

func equal(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

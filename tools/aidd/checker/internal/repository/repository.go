package repository

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
)

type observedEntry struct {
	content    []byte
	hasContent bool
	digest     string
	hasDigest  bool
	linkTarget string
	hasLink    bool
	mode       fs.FileMode
}

type Snapshot struct {
	Root     string
	root     *os.Root
	observed map[string]observedEntry
	gitHead  string
}

type WorktreeIdentity struct {
	Path   string
	Type   string
	Mode   string
	SHA256 string
}

const MaxHeadBlobBytes = 16 * 1024 * 1024

func Open(ctx context.Context, root string) (*Snapshot, error) {
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, diagnostic.New("AIDD_REPO_ROOT", "", "repository", "repository root is invalid", nil, err.Error())
	}
	canonical, err := filepath.EvalSymlinks(absolute)
	if err != nil {
		return nil, diagnostic.New("AIDD_REPO_ROOT", "", "repository", "repository root cannot be resolved", nil, err.Error())
	}
	command := exec.CommandContext(ctx, "git", "-C", canonical, "rev-parse", "--show-toplevel")
	output, err := command.Output()
	if err != nil {
		return nil, diagnostic.New("AIDD_REPO_GIT", "", "repository", "repository root must be a Git worktree", nil, err.Error())
	}
	gitRoot := strings.TrimSpace(string(output))
	resolvedGitRoot, err := filepath.EvalSymlinks(gitRoot)
	if err != nil || resolvedGitRoot != canonical {
		return nil, diagnostic.New("AIDD_REPO_ROOT", "", "repository", "--repo-root must be the canonical Git worktree root", canonical, gitRoot)
	}
	confined, err := os.OpenRoot(canonical)
	if err != nil {
		return nil, diagnostic.New("AIDD_REPO_OPEN", "", "repository", "repository root cannot be opened", canonical, err.Error())
	}
	return &Snapshot{Root: canonical, root: confined, observed: map[string]observedEntry{}}, nil
}

func (snapshot *Snapshot) Close() error {
	if snapshot == nil || snapshot.root == nil {
		return nil
	}
	return snapshot.root.Close()
}

func (snapshot *Snapshot) Read(path string) ([]byte, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return nil, err
	}
	if cached, ok := snapshot.observed[normalized]; ok && cached.hasContent {
		return bytes.Clone(cached.content), nil
	}
	info, exists, err := snapshot.inspect(normalized, false)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, diagnostic.New("AIDD_FILE_READ", normalized, "repository", "required file cannot be read", "regular file", "not found")
	}
	if !info.Mode().IsRegular() {
		return nil, diagnostic.New("AIDD_FILE_TYPE", normalized, "repository", "required path must be a regular file", "regular file", info.Mode().String())
	}
	content, err := snapshot.root.ReadFile(filepath.FromSlash(normalized))
	if err != nil {
		return nil, diagnostic.New("AIDD_FILE_READ", normalized, "repository", "required file cannot be read", nil, err.Error())
	}
	current, exists, err := snapshot.inspect(normalized, false)
	if err != nil || !exists || current.Mode() != info.Mode() {
		actual := "missing or changed type/mode"
		if err != nil {
			actual = err.Error()
		}
		return nil, diagnostic.New("AIDD_SNAPSHOT_DRIFT", normalized, "repository", "input changed while it was read", info.Mode().String(), actual)
	}
	snapshot.observed[normalized] = observedEntry{content: bytes.Clone(content), hasContent: true, mode: info.Mode()}
	return bytes.Clone(content), nil
}

func (snapshot *Snapshot) Exists(path string) (bool, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return false, err
	}
	info, exists, err := snapshot.inspect(normalized, true)
	if err != nil || !exists {
		return exists, err
	}
	snapshot.observed[normalized] = observedEntry{mode: info.Mode()}
	return true, nil
}

func (snapshot *Snapshot) Mode(path string) (fs.FileMode, bool, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return 0, false, err
	}
	info, exists, err := snapshot.inspect(normalized, true)
	if err != nil || !exists {
		return 0, exists, err
	}
	observed := snapshot.observed[normalized]
	observed.mode = info.Mode()
	snapshot.observed[normalized] = observed
	return info.Mode(), true, nil
}

func (snapshot *Snapshot) RegularFiles(path string) ([]string, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return nil, err
	}
	mode, exists, err := snapshot.Mode(normalized)
	if err != nil {
		return nil, err
	}
	if !exists || !mode.IsDir() {
		actual := "not found"
		if exists {
			actual = mode.String()
		}
		return nil, diagnostic.New("AIDD_DIRECTORY_TYPE", normalized, "repository", "ownership tree must be a directory", "directory", actual)
	}
	result := []string{}
	var visit func(string) error
	visit = func(directory string) error {
		entries, err := snapshot.ReadDir(directory)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			child := directory + "/" + entry.Name()
			mode, exists, err := snapshot.Mode(child)
			if err != nil {
				return err
			}
			if !exists {
				return diagnostic.New("AIDD_SNAPSHOT_DRIFT", child, "repository", "directory entry disappeared while inventory was built", "existing entry", "missing")
			}
			if mode.IsDir() {
				if err := visit(child); err != nil {
					return err
				}
				continue
			}
			if !mode.IsRegular() {
				return diagnostic.New("AIDD_FILE_TYPE", child, "repository", "ownership tree must contain only regular files", "regular file", mode.String())
			}
			result = append(result, child)
		}
		return nil
	}
	if err := visit(normalized); err != nil {
		return nil, err
	}
	sort.Strings(result)
	return result, nil
}

func (snapshot *Snapshot) ReadDir(path string) ([]os.DirEntry, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return nil, err
	}
	info, exists, err := snapshot.inspect(normalized, false)
	if err != nil {
		return nil, err
	}
	if !exists || !info.IsDir() {
		actual := "not found"
		if exists {
			actual = info.Mode().String()
		}
		return nil, diagnostic.New("AIDD_DIRECTORY_TYPE", normalized, "repository", "required path must be a directory", "directory", actual)
	}
	directory, err := snapshot.root.Open(filepath.FromSlash(normalized))
	if err != nil {
		return nil, diagnostic.New("AIDD_DIRECTORY_READ", normalized, "repository", "required directory cannot be read", "directory", err.Error())
	}
	defer directory.Close()
	entries, err := directory.ReadDir(-1)
	if err != nil {
		return nil, diagnostic.New("AIDD_DIRECTORY_READ", normalized, "repository", "required directory cannot be read", nil, err.Error())
	}
	sort.Slice(entries, func(left, right int) bool { return entries[left].Name() < entries[right].Name() })
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink != 0 {
			child := normalized + "/" + entry.Name()
			return nil, diagnostic.New("AIDD_PATH_SYMLINK", child, "repository", "repository inputs and outputs must not traverse symlinks", nil, child)
		}
	}
	snapshot.observed[normalized] = observedEntry{mode: info.Mode()}
	return entries, nil
}

func (snapshot *Snapshot) ResolveDirectory(path string) (string, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return "", err
	}
	info, exists, err := snapshot.inspect(normalized, false)
	if err != nil {
		return "", err
	}
	if !exists || !info.IsDir() {
		actual := "not found"
		if exists {
			actual = info.Mode().String()
		}
		return "", diagnostic.New("AIDD_DIRECTORY_TYPE", normalized, "repository", "runner working directory must be a directory", "directory", actual)
	}
	snapshot.observed[normalized] = observedEntry{mode: info.Mode()}
	return filepath.Join(snapshot.Root, filepath.FromSlash(normalized)), nil
}

func (snapshot *Snapshot) AssertUnchanged() error {
	paths := make([]string, 0, len(snapshot.observed))
	for path := range snapshot.observed {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	for _, path := range paths {
		expected := snapshot.observed[path]
		info, exists, err := snapshot.inspectEntry(path, false, expected.hasLink)
		if err != nil || !exists || info.Mode() != expected.mode {
			actual := "missing or changed type/mode"
			if err != nil {
				actual = err.Error()
			}
			return diagnostic.New("AIDD_SNAPSHOT_DRIFT", path, "repository", "input changed after snapshot", expected.mode.String(), actual)
		}
		if expected.hasContent {
			current, readErr := snapshot.root.ReadFile(filepath.FromSlash(path))
			if readErr != nil || !bytes.Equal(current, expected.content) {
				actual := "changed bytes"
				if readErr != nil {
					actual = readErr.Error()
				}
				return diagnostic.New("AIDD_SNAPSHOT_DRIFT", path, "repository", "input changed after snapshot", "unchanged bytes", actual)
			}
		}
		if expected.hasDigest {
			current, readErr := snapshot.hashRegularFile(path)
			if readErr != nil || current != expected.digest {
				actual := current
				if readErr != nil {
					actual = readErr.Error()
				}
				return diagnostic.New("AIDD_SNAPSHOT_DRIFT", path, "repository", "input changed after snapshot", expected.digest, actual)
			}
		}
		if expected.hasLink {
			current, readErr := snapshot.root.Readlink(filepath.FromSlash(path))
			if readErr != nil || current != expected.linkTarget {
				actual := current
				if readErr != nil {
					actual = readErr.Error()
				}
				return diagnostic.New("AIDD_SNAPSHOT_DRIFT", path, "repository", "symbolic link target changed after snapshot", expected.linkTarget, actual)
			}
		}
	}
	return nil
}

func (snapshot *Snapshot) ObserveWorktreeIdentity(path string) (WorktreeIdentity, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return WorktreeIdentity{}, err
	}
	info, exists, err := snapshot.inspectEntry(normalized, false, true)
	if err != nil {
		return WorktreeIdentity{}, err
	}
	if !exists {
		return WorktreeIdentity{}, diagnostic.New("AIDD_UNTRACKED_MISSING", normalized, "repository", "untracked path disappeared while its identity was captured", "existing entry", "missing")
	}
	mode := fmt.Sprintf("%04o", info.Mode().Perm())
	if info.Mode()&os.ModeSymlink != 0 {
		target, readErr := snapshot.root.Readlink(filepath.FromSlash(normalized))
		if readErr != nil {
			return WorktreeIdentity{}, diagnostic.New("AIDD_UNTRACKED_READ", normalized, "repository", "untracked symbolic link target cannot be read", nil, readErr.Error())
		}
		current, currentExists, statErr := snapshot.inspectEntry(normalized, false, true)
		if statErr != nil || !currentExists || current.Mode() != info.Mode() {
			actual := "missing or changed type/mode"
			if statErr != nil {
				actual = statErr.Error()
			}
			return WorktreeIdentity{}, diagnostic.New("AIDD_SNAPSHOT_DRIFT", normalized, "repository", "untracked symbolic link changed while its identity was captured", info.Mode().String(), actual)
		}
		digest := sha256.Sum256([]byte(target))
		snapshot.observed[normalized] = observedEntry{mode: info.Mode(), linkTarget: target, hasLink: true}
		return WorktreeIdentity{Path: normalized, Type: "symlink", Mode: mode, SHA256: hex.EncodeToString(digest[:])}, nil
	}
	if !info.Mode().IsRegular() {
		return WorktreeIdentity{}, diagnostic.New("AIDD_UNTRACKED_TYPE", normalized, "repository", "untracked baseline accepts only regular files and symbolic links", []string{"regular", "symlink"}, info.Mode().String())
	}
	digest, readErr := snapshot.hashRegularFile(normalized)
	if readErr != nil {
		return WorktreeIdentity{}, readErr
	}
	current, currentExists, statErr := snapshot.inspectEntry(normalized, false, false)
	if statErr != nil || !currentExists || current.Mode() != info.Mode() || current.Size() != info.Size() || current.ModTime() != info.ModTime() {
		actual := "missing or changed mode/size/mtime"
		if statErr != nil {
			actual = statErr.Error()
		}
		return WorktreeIdentity{}, diagnostic.New("AIDD_SNAPSHOT_DRIFT", normalized, "repository", "untracked file changed while its identity was captured", map[string]any{"mode": info.Mode().String(), "size": info.Size(), "mtime": info.ModTime()}, actual)
	}
	snapshot.observed[normalized] = observedEntry{mode: info.Mode(), digest: digest, hasDigest: true}
	return WorktreeIdentity{Path: normalized, Type: "regular", Mode: mode, SHA256: digest}, nil
}

func (snapshot *Snapshot) hashRegularFile(path string) (string, error) {
	file, err := snapshot.root.Open(filepath.FromSlash(path))
	if err != nil {
		return "", diagnostic.New("AIDD_UNTRACKED_READ", path, "repository", "untracked regular file cannot be opened", nil, err.Error())
	}
	defer file.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return "", diagnostic.New("AIDD_UNTRACKED_READ", path, "repository", "untracked regular file cannot be hashed", nil, err.Error())
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

func (snapshot *Snapshot) WriteAtomic(path string, content []byte) error {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return err
	}
	if _, _, err := snapshot.inspect(normalized, true); err != nil {
		return err
	}
	directory := filepath.ToSlash(filepath.Dir(filepath.FromSlash(normalized)))
	if directory == "." {
		directory = ""
	}
	if directory != "" {
		if err := snapshot.root.MkdirAll(filepath.FromSlash(directory), 0o755); err != nil {
			return diagnostic.New("AIDD_WRITE_DIRECTORY", normalized, "repository", "output directory cannot be created", nil, err.Error())
		}
		if info, exists, err := snapshot.inspect(directory, false); err != nil || !exists || !info.IsDir() {
			actual := "missing or not a directory"
			if err != nil {
				actual = err.Error()
			}
			return diagnostic.New("AIDD_WRITE_DIRECTORY", normalized, "repository", "output directory cannot be trusted", "directory without symlinks", actual)
		}
	}
	random := make([]byte, 12)
	if _, err := rand.Read(random); err != nil {
		return diagnostic.New("AIDD_WRITE_TEMP", normalized, "repository", "temporary output name cannot be generated", nil, err.Error())
	}
	temporaryName := ".aidd-checker-" + hex.EncodeToString(random)
	temporaryPath := temporaryName
	if directory != "" {
		temporaryPath = directory + "/" + temporaryName
	}
	temporary, err := snapshot.root.OpenFile(filepath.FromSlash(temporaryPath), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return diagnostic.New("AIDD_WRITE_TEMP", normalized, "repository", "temporary output cannot be created", nil, err.Error())
	}
	cleanup := true
	defer func() {
		if cleanup {
			_ = snapshot.root.Remove(filepath.FromSlash(temporaryPath))
		}
	}()
	if _, err := temporary.Write(content); err != nil {
		_ = temporary.Close()
		return diagnostic.New("AIDD_WRITE", normalized, "repository", "output cannot be written", nil, err.Error())
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return diagnostic.New("AIDD_WRITE_SYNC", normalized, "repository", "output cannot be synchronized", nil, err.Error())
	}
	if err := temporary.Close(); err != nil {
		return diagnostic.New("AIDD_WRITE_CLOSE", normalized, "repository", "output cannot be closed", nil, err.Error())
	}
	if err := snapshot.root.Rename(filepath.FromSlash(temporaryPath), filepath.FromSlash(normalized)); err != nil {
		return diagnostic.New("AIDD_WRITE_RENAME", normalized, "repository", "output cannot be replaced atomically", nil, err.Error())
	}
	cleanup = false
	delete(snapshot.observed, normalized)
	return nil
}

func (snapshot *Snapshot) inspect(path string, allowMissing bool) (os.FileInfo, bool, error) {
	return snapshot.inspectEntry(path, allowMissing, false)
}

func (snapshot *Snapshot) inspectEntry(path string, allowMissing, allowFinalSymlink bool) (os.FileInfo, bool, error) {
	parts := strings.Split(path, "/")
	for index := range parts {
		current := filepath.FromSlash(strings.Join(parts[:index+1], "/"))
		info, err := snapshot.root.Lstat(current)
		if os.IsNotExist(err) && allowMissing {
			return nil, false, nil
		}
		if err != nil {
			return nil, false, diagnostic.New("AIDD_PATH_STAT", path, "repository", "path cannot be inspected", nil, err.Error())
		}
		if info.Mode()&os.ModeSymlink != 0 && !(allowFinalSymlink && index == len(parts)-1) {
			return nil, false, diagnostic.New("AIDD_PATH_SYMLINK", path, "repository", "repository inputs and outputs must not traverse symlinks", nil, filepath.ToSlash(current))
		}
		if index < len(parts)-1 && !info.IsDir() {
			return nil, false, diagnostic.New("AIDD_PATH_COMPONENT_TYPE", path, "repository", "path components must be directories", "directory", info.Mode().String())
		}
		if index == len(parts)-1 {
			return info, true, nil
		}
	}
	return nil, false, diagnostic.New("AIDD_PATH_INVALID", path, "repository", "path must not be empty", nil, path)
}

func (snapshot *Snapshot) Git(ctx context.Context, arguments ...string) ([]byte, error) {
	commandArguments := append([]string{"-C", snapshot.Root}, arguments...)
	command := exec.CommandContext(ctx, "git", commandArguments...)
	output, err := command.Output()
	if err != nil {
		actual := err.Error()
		if exitErr, ok := err.(*exec.ExitError); ok && len(exitErr.Stderr) > 0 {
			actual = string(exitErr.Stderr)
		}
		return nil, diagnostic.New("AIDD_GIT", strings.Join(arguments, " "), "git", "Git command failed", "exit 0", actual)
	}
	return output, nil
}

// Headはsnapshotが最初に観測したGit HEADを固定し、以後のdriftを拒否する。
func (snapshot *Snapshot) Head(ctx context.Context) (string, error) {
	output, err := snapshot.Git(ctx, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return "", err
	}
	current := strings.TrimSpace(string(output))
	decoded, decodeErr := hex.DecodeString(current)
	if decodeErr != nil || len(decoded) != 20 {
		return "", diagnostic.New("AIDD_GIT_HEAD", "HEAD", "repository", "Git HEAD must be a full lowercase commit ID", "40 lowercase hexadecimal characters", current)
	}
	if snapshot.gitHead == "" {
		snapshot.gitHead = current
		return current, nil
	}
	if current != snapshot.gitHead {
		return "", diagnostic.New("AIDD_GIT_HEAD_DRIFT", "HEAD", "repository", "Git HEAD changed during repository snapshot validation", snapshot.gitHead, current)
	}
	return snapshot.gitHead, nil
}

func (snapshot *Snapshot) AssertGitHeadUnchanged(ctx context.Context) error {
	_, err := snapshot.Head(ctx)
	return err
}

// ReadHeadBlobはGit HEADの通常ファイルblobだけを読む。
// symlink、tree、上限超過objectは内容を読む前に拒否する。
func (snapshot *Snapshot) ReadHeadBlob(ctx context.Context, path string) ([]byte, bool, error) {
	return snapshot.readHeadBlob(ctx, path, MaxHeadBlobBytes)
}

func (snapshot *Snapshot) readHeadBlob(ctx context.Context, path string, maximum int64) ([]byte, bool, error) {
	normalized, err := pathcontract.ValidateRelativePath(path)
	if err != nil {
		return nil, false, err
	}
	head, err := snapshot.Head(ctx)
	if err != nil {
		return nil, false, err
	}
	listing, err := snapshot.Git(ctx, "ls-tree", "-z", head, "--", normalized)
	if err != nil {
		return nil, false, err
	}
	if len(listing) == 0 {
		return nil, false, nil
	}
	if listing[len(listing)-1] != 0 {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_ENTRY", normalized, "git", "Git HEAD entry must be NUL-terminated", "NUL-terminated entry", string(listing))
	}
	records := bytes.Split(listing[:len(listing)-1], []byte{0})
	if len(records) != 1 {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_ENTRY", normalized, "git", "Git HEAD lookup must return exactly one entry", 1, len(records))
	}
	parts := bytes.SplitN(records[0], []byte{'\t'}, 2)
	if len(parts) != 2 || string(parts[1]) != normalized {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_ENTRY", normalized, "git", "Git HEAD lookup returned a different path", normalized, string(records[0]))
	}
	metadata := strings.Fields(string(parts[0]))
	if len(metadata) != 3 {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_ENTRY", normalized, "git", "Git HEAD entry metadata is invalid", "mode type object-id", string(parts[0]))
	}
	mode, objectType, objectID := metadata[0], metadata[1], metadata[2]
	if (mode != "100644" && mode != "100755") || objectType != "blob" {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_TYPE", normalized, "git", "Git HEAD input must be a regular file", []string{"100644 blob", "100755 blob"}, map[string]string{"mode": mode, "type": objectType})
	}
	sizeBytes, err := snapshot.Git(ctx, "cat-file", "-s", objectID)
	if err != nil {
		return nil, false, err
	}
	size, err := strconv.ParseInt(strings.TrimSpace(string(sizeBytes)), 10, 64)
	if err != nil || size < 0 {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_SIZE", normalized, "git", "Git HEAD blob size is invalid", "non-negative decimal size", strings.TrimSpace(string(sizeBytes)))
	}
	if size > maximum {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_SIZE", normalized, "git", "Git HEAD blob exceeds the size limit", maximum, size)
	}
	content, err := snapshot.Git(ctx, "cat-file", "blob", objectID)
	if err != nil {
		return nil, false, err
	}
	if int64(len(content)) != size {
		return nil, false, diagnostic.New("AIDD_GIT_HEAD_SIZE", normalized, "git", "Git HEAD blob size changed while it was read", size, len(content))
	}
	return content, true, nil
}

func (snapshot *Snapshot) Ignored(ctx context.Context, paths []string) ([]string, error) {
	arguments := []string{"-C", snapshot.Root, "check-ignore", "--stdin", "-z"}
	input := make([][]byte, 0, len(paths))
	for _, path := range paths {
		normalized, err := pathcontract.ValidateRelativePath(path)
		if err != nil {
			return nil, err
		}
		input = append(input, []byte(normalized))
	}
	if len(paths) == 0 {
		return nil, nil
	}
	command := exec.CommandContext(ctx, "git", arguments...)
	command.Stdin = bytes.NewReader(append(bytes.Join(input, []byte{0}), 0))
	output, err := command.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return nil, nil
		}
		return nil, diagnostic.New("AIDD_GIT_IGNORE", "", "git", "Git ignore status could not be determined", "exit 0 or 1", err.Error())
	}
	ignored := []string{}
	for _, raw := range bytes.Split(output, []byte{0}) {
		if len(raw) > 0 {
			ignored = append(ignored, string(raw))
		}
	}
	return ignored, nil
}

func WorkspacePath(workspace, suffix string) (string, error) {
	if err := pathcontract.ValidateWorkspaceName(workspace); err != nil {
		return "", err
	}
	return pathcontract.ValidateRelativePath(fmt.Sprintf("docs/ai-driven-development/workspaces/%s/%s", workspace, suffix))
}

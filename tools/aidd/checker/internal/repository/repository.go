package repository

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

type observedEntry struct {
	content    []byte
	hasContent bool
	mode       fs.FileMode
}

type Snapshot struct {
	Root     string
	root     *os.Root
	observed map[string]observedEntry
}

type GitIndexEntry struct {
	Mode     string
	ObjectID string
	Stage    int
}

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

func ValidateRelativePath(path string) (string, error) {
	if path == "" || !utf8.ValidString(path) || strings.Contains(path, "\\") || filepath.IsAbs(path) {
		return "", diagnostic.New("AIDD_PATH_INVALID", path, "repository", "path must be a normalized UTF-8 repository-relative path", nil, path)
	}
	for _, character := range path {
		if unicode.IsControl(character) {
			return "", diagnostic.New("AIDD_PATH_CONTROL", path, "repository", "path must not contain control characters", nil, path)
		}
	}
	cleaned := filepath.ToSlash(filepath.Clean(path))
	if cleaned != path || cleaned == "." || strings.HasPrefix(cleaned, "../") {
		return "", diagnostic.New("AIDD_PATH_NONCANONICAL", path, "repository", "path is not canonical", cleaned, path)
	}
	for _, part := range strings.Split(path, "/") {
		if part == ".git" {
			return "", diagnostic.New("AIDD_PATH_GIT_METADATA", path, "repository", "path must not enter Git metadata", nil, path)
		}
	}
	return path, nil
}

func (snapshot *Snapshot) Read(path string) ([]byte, error) {
	normalized, err := ValidateRelativePath(path)
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
	normalized, err := ValidateRelativePath(path)
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
	normalized, err := ValidateRelativePath(path)
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
	normalized, err := ValidateRelativePath(path)
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
	normalized, err := ValidateRelativePath(path)
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
	normalized, err := ValidateRelativePath(path)
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
		info, exists, err := snapshot.inspect(path, false)
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
	}
	return nil
}

func (snapshot *Snapshot) WriteAtomic(path string, content []byte) error {
	normalized, err := ValidateRelativePath(path)
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
		if info.Mode()&os.ModeSymlink != 0 {
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

func (snapshot *Snapshot) GitIndexEntries(ctx context.Context, paths []string) (map[string][]GitIndexEntry, error) {
	requested := make(map[string]struct{}, len(paths))
	for _, path := range paths {
		normalized, err := ValidateRelativePath(path)
		if err != nil {
			return nil, err
		}
		requested[normalized] = struct{}{}
	}
	result := make(map[string][]GitIndexEntry, len(requested))
	if len(requested) == 0 {
		return result, nil
	}
	output, err := snapshot.Git(ctx, "ls-files", "--stage", "--full-name", "--no-abbrev", "-z")
	if err != nil {
		return nil, err
	}
	for _, record := range bytes.Split(output, []byte{0}) {
		if len(record) == 0 {
			continue
		}
		header, rawPath, ok := bytes.Cut(record, []byte{'\t'})
		if !ok {
			return nil, diagnostic.New("AIDD_GIT_INDEX_FORMAT", "", "git", "Git index entry is malformed", "<mode> <object> <stage>\\t<path>", string(record))
		}
		path := string(rawPath)
		if _, wanted := requested[path]; !wanted {
			continue
		}
		fields := strings.Fields(string(header))
		if len(fields) != 3 || len(fields[0]) != 6 {
			return nil, diagnostic.New("AIDD_GIT_INDEX_FORMAT", path, "git", "Git index entry header is malformed", "<mode> <object> <stage>", string(header))
		}
		if _, parseErr := strconv.ParseUint(fields[0], 8, 32); parseErr != nil {
			return nil, diagnostic.New("AIDD_GIT_INDEX_FORMAT", path, "git", "Git index mode is invalid", "six octal digits", fields[0])
		}
		if _, decodeErr := hex.DecodeString(fields[1]); decodeErr != nil || fields[1] == "" {
			return nil, diagnostic.New("AIDD_GIT_INDEX_FORMAT", path, "git", "Git index object ID is invalid", "full hexadecimal object ID", fields[1])
		}
		stage, parseErr := strconv.Atoi(fields[2])
		if parseErr != nil || stage < 0 || stage > 3 {
			return nil, diagnostic.New("AIDD_GIT_INDEX_FORMAT", path, "git", "Git index stage is invalid", "0 through 3", fields[2])
		}
		result[path] = append(result[path], GitIndexEntry{Mode: fields[0], ObjectID: fields[1], Stage: stage})
	}
	for path := range result {
		sort.Slice(result[path], func(left, right int) bool {
			if result[path][left].Stage != result[path][right].Stage {
				return result[path][left].Stage < result[path][right].Stage
			}
			if result[path][left].Mode != result[path][right].Mode {
				return result[path][left].Mode < result[path][right].Mode
			}
			return result[path][left].ObjectID < result[path][right].ObjectID
		})
	}
	return result, nil
}

func (snapshot *Snapshot) Ignored(ctx context.Context, paths []string) ([]string, error) {
	arguments := []string{"-C", snapshot.Root, "check-ignore", "--stdin", "-z"}
	input := make([][]byte, 0, len(paths))
	for _, path := range paths {
		normalized, err := ValidateRelativePath(path)
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
	if workspace == "" || strings.Contains(workspace, "/") || strings.Contains(workspace, "\\") || workspace == "." || workspace == ".." {
		return "", diagnostic.New("AIDD_WORKSPACE", workspace, "workspace", "workspace name is invalid", "single path segment", workspace)
	}
	return ValidateRelativePath(fmt.Sprintf("docs/ai-driven-development/workspaces/%s/%s", workspace, suffix))
}

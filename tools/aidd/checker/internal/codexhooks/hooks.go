package codexhooks

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

const (
	HookEventStop          = "Stop"
	HookEventSessionStart  = "SessionStart"
	SessionStartCompact    = "compact"
	HookDecisionBlock      = "block"
	cacheSchemaVersion     = 1
	cacheResultPassed      = "passed"
	maxValidationOutputLen = 2048
)

// HookInput is the stable subset of Codex lifecycle input used by this hook.
type HookInput struct {
	HookEventName  string `json:"hook_event_name"`
	Source         string `json:"source,omitempty"`
	StopHookActive bool   `json:"stop_hook_active,omitempty"`
	Cwd            string `json:"cwd,omitempty"`
}

// HookSpecificOutput is the event-scoped response shape required by Codex
// Hooks for SessionStart. Stop decisions remain top-level fields on
// HookOutput.
type HookSpecificOutput struct {
	HookEventName     string `json:"hookEventName"`
	AdditionalContext string `json:"additionalContext,omitempty"`
}

// HookOutput contains only the decisions supported by the lifecycle hook
// contract. An empty output allows the existing Codex workflow to continue.
type HookOutput struct {
	Decision           string              `json:"decision,omitempty"`
	Reason             string              `json:"reason,omitempty"`
	HookSpecificOutput *HookSpecificOutput `json:"hookSpecificOutput,omitempty"`
}

// Options provides deterministic seams for tests while keeping the production
// path limited to Git, the existing checker, and a derived external cache.
type Options struct {
	CacheDir         string
	ValidationRunner func(context.Context, string) error
	DiffPaths        func(context.Context, string) ([]string, error)
}

type cacheEntry struct {
	Version     int    `json:"version"`
	Fingerprint string `json:"fingerprint"`
	Result      string `json:"result"`
}

type validationFailure struct {
	Name    string
	Command []string
	Output  string
	Err     error
}

func (failure *validationFailure) Error() string {
	if failure == nil {
		return "AIDD validation failed"
	}
	message := fmt.Sprintf("validation %s failed", failure.Name)
	if failure.Output != "" {
		message += ": " + failure.Output
	} else if failure.Err != nil {
		message += ": " + failure.Err.Error()
	}
	return message
}

func (failure *validationFailure) Unwrap() error {
	if failure == nil {
		return nil
	}
	return failure.Err
}

// Handle dispatches one Codex lifecycle input to the matching hook handler.
func Handle(ctx context.Context, input HookInput, options ...Options) (HookOutput, error) {
	switch input.HookEventName {
	case HookEventStop:
		return HandleStop(ctx, input, options...)
	case HookEventSessionStart:
		return HandleSessionStart(input), nil
	case "":
		// Some callers invoke the command with the event supplied by the
		// surrounding hook configuration. Compact is unambiguous here.
		if input.Source == SessionStartCompact {
			return HandleSessionStart(input), nil
		}
		return HookOutput{}, nil
	default:
		return HookOutput{}, nil
	}
}

// HandleStop evaluates only the AIDD control-plane portion of the Git
// worktree. Successful fingerprints are skipped using a derived cache, while
// a re-entered Stop hook is allowed to finish without another block.
func HandleStop(ctx context.Context, input HookInput, options ...Options) (HookOutput, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if len(options) > 1 {
		return HookOutput{}, errors.New("codexhooks accepts at most one Options value")
	}
	var option Options
	if len(options) == 1 {
		option = options[0]
	}
	if input.StopHookActive {
		return RetryDecision(true, false, ""), nil
	}

	root := input.Cwd
	if root == "" {
		var err error
		root, err = os.Getwd()
		if err != nil {
			return RetryDecision(false, false, "control-plane diff detection failed: "+err.Error()), nil
		}
	}
	root, err := gitRepositoryRoot(ctx, root)
	if err != nil {
		return RetryDecision(false, false, "repository root detection failed: "+err.Error()), nil
	}
	diffPaths := option.DiffPaths
	if diffPaths == nil {
		diffPaths = ControlPlaneDiff
	}
	paths, err := diffPaths(ctx, root)
	if err != nil {
		return RetryDecision(false, false, "control-plane diff detection failed: "+err.Error()), nil
	}
	paths = controlPlanePaths(paths)
	if len(paths) == 0 {
		return HookOutput{}, nil
	}
	state, err := controlPlaneState(ctx, root, paths)
	if err != nil {
		return RetryDecision(false, false, "control-plane state capture failed: "+err.Error()), nil
	}
	fingerprint := ControlPlaneFingerprint(paths, state)
	cacheDir := option.CacheDir
	if cached, cacheErr := hasSuccessfulCache(cacheDir, fingerprint); cacheErr == nil && cached {
		return HookOutput{}, nil
	}

	validationRunner := option.ValidationRunner
	if validationRunner == nil {
		validationRunner = RunValidations
	}
	if err := validationRunner(ctx, root); err != nil {
		return RetryDecision(false, false, err.Error()), nil
	}
	_ = writeSuccessfulCache(cacheDir, fingerprint)
	return HookOutput{}, nil
}

// RetryDecision normalizes Stop outcomes. A successful validation and a
// re-entered hook both produce no decision; only the first failed validation
// requests continuation with a substantive reason.
func RetryDecision(stopHookActive, validationSucceeded bool, reason string) HookOutput {
	if stopHookActive || validationSucceeded {
		return HookOutput{}
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		reason = "AIDD control-plane validation failed"
	}
	return HookOutput{Decision: HookDecisionBlock, Reason: reason}
}

// HandleSessionStart injects the fixed five-invariant context only after a
// compact SessionStart event.
func HandleSessionStart(input HookInput) HookOutput {
	if input.HookEventName != "" && input.HookEventName != HookEventSessionStart {
		return HookOutput{}
	}
	if input.Source != SessionStartCompact {
		return HookOutput{}
	}
	return HookOutput{HookSpecificOutput: &HookSpecificOutput{
		HookEventName:     HookEventSessionStart,
		AdditionalContext: CompactContext(),
	}}
}

// CompactContext is deliberately static: it carries no Issue, artifact, or
// transcript content and does not become a second Goal or phase state store.
func CompactContext() string {
	return strings.Join([]string{
		"AIDD工程不変条件:",
		"- 現在Goalを継続する。",
		"- Goalの所有は親agentが担う。",
		"- 上流成果物はread-onlyとして扱う。",
		"- Build / Verifyの次はShipへ進む。",
		"- Learnは自動実行しない。",
	}, "\n")
}

// ControlPlaneFingerprint returns a stable digest for a control-plane change.
// HandleStop always supplies the current Git/file state as the optional second
// argument, so re-editing one path produces a new cache key without reading
// Goal or phase state. The path-only form remains useful for path identity
// tests and callers that do not have a repository snapshot.
func ControlPlaneFingerprint(paths []string, state ...[]byte) string {
	unique := make(map[string]struct{}, len(paths))
	for _, path := range paths {
		path = filepath.ToSlash(strings.TrimSpace(path))
		if path != "" {
			unique[path] = struct{}{}
		}
	}
	ordered := make([]string, 0, len(unique))
	for path := range unique {
		ordered = append(ordered, path)
	}
	sort.Strings(ordered)
	digest := sha256.New()
	_, _ = digest.Write([]byte("AIDD-codex-hooks-fingerprint-v2\x00"))
	for _, path := range ordered {
		_, _ = digest.Write([]byte(path))
		_, _ = digest.Write([]byte{0})
	}
	if len(state) > 0 {
		_, _ = digest.Write([]byte("state\x00"))
		_, _ = digest.Write(state[0])
	}
	return hex.EncodeToString(digest.Sum(nil))
}

// IsControlPlanePath reports whether a repository-relative path is covered by
// the checker rule's AIDD control-plane surfaces. Workspace artifacts are
// intentionally excluded because they are phase evidence, not hook inputs.
func IsControlPlanePath(path string) bool {
	path = filepath.ToSlash(strings.TrimPrefix(strings.TrimSpace(path), "./"))
	if path == ".codex/hooks.json" {
		return true
	}
	for _, prefix := range []string{
		".codex/agents/",
		".codex/hooks/",
		".agents/skills/aidd-cycle/",
		".agents/skills/goal-setting/",
		"tools/aidd/",
		"docs/ai-driven-development/contracts/",
	} {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	for _, exact := range []string{
		".codex/config.toml",
		"docs/ai-driven-development/aidd-checker.md",
		"docs/ai-driven-development/aidd-checker-operations.md",
		"docs/ai-driven-development/workflow.md",
		"docs/ai-driven-development/overview.md",
	} {
		if path == exact {
			return true
		}
	}
	return false
}

func controlPlanePaths(paths []string) []string {
	unique := make(map[string]struct{}, len(paths))
	for _, path := range paths {
		normalized := filepath.ToSlash(strings.TrimPrefix(strings.TrimSpace(path), "./"))
		if normalized != "" && IsControlPlanePath(normalized) {
			unique[normalized] = struct{}{}
		}
	}
	result := make([]string, 0, len(unique))
	for path := range unique {
		result = append(result, path)
	}
	sort.Strings(result)
	return result
}

// ControlPlaneDiff obtains tracked and non-ignored untracked paths from the
// canonical Git worktree without reading transcripts or AIDD state files.
func ControlPlaneDiff(ctx context.Context, root string) ([]string, error) {
	if root == "" {
		return nil, errors.New("repository root is empty")
	}
	tracked, err := gitPathList(ctx, root, "diff", "--no-ext-diff", "--name-only", "-z", "HEAD", "--")
	if err != nil {
		return nil, fmt.Errorf("git diff: %w", err)
	}
	untracked, err := gitPathList(ctx, root, "ls-files", "--others", "--exclude-standard", "-z", "--")
	if err != nil {
		return nil, fmt.Errorf("git untracked paths: %w", err)
	}
	return controlPlanePaths(append(tracked, untracked...)), nil
}

func gitRepositoryRoot(ctx context.Context, path string) (string, error) {
	if path == "" {
		return "", errors.New("working directory is empty")
	}
	command := exec.CommandContext(ctx, "git", "-C", path, "rev-parse", "--show-toplevel")
	command.Env = canonicalGitEnvironment(os.Environ())
	output, err := command.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && len(exitErr.Stderr) > 0 {
			return "", fmt.Errorf("%s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return "", err
	}
	root := strings.TrimSpace(string(output))
	if root == "" {
		return "", errors.New("git returned an empty repository root")
	}
	return filepath.Clean(root), nil
}

func controlPlaneState(ctx context.Context, root string, paths []string) ([]byte, error) {
	paths = controlPlanePaths(paths)
	if len(paths) == 0 {
		return []byte("AIDD-codex-hooks-state-v2\x00"), nil
	}
	trackedDiff, err := gitOutput(ctx, root, append([]string{
		"diff", "--no-ext-diff", "--binary", "--full-index", "--no-color", "HEAD", "--",
	}, paths...)...)
	if err != nil {
		return nil, fmt.Errorf("git control-plane diff: %w", err)
	}
	untracked, err := gitOutput(ctx, root, append([]string{
		"ls-files", "--others", "--exclude-standard", "-z", "--",
	}, paths...)...)
	if err != nil {
		return nil, fmt.Errorf("git control-plane untracked state: %w", err)
	}

	var state bytes.Buffer
	appendStateField(&state, "version", []byte("AIDD-codex-hooks-state-v2"))
	appendStateField(&state, "tracked-diff", trackedDiff)
	appendStateField(&state, "untracked", untracked)
	for _, path := range paths {
		appendStateField(&state, "path", []byte(path))
		fullPath := filepath.Join(root, filepath.FromSlash(path))
		info, err := os.Lstat(fullPath)
		if errors.Is(err, os.ErrNotExist) {
			appendStateField(&state, "kind", []byte("missing"))
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("lstat %s: %w", path, err)
		}
		appendStateField(&state, "mode", []byte(info.Mode().String()))
		switch info.Mode() & os.ModeType {
		case 0:
			content, err := os.ReadFile(fullPath)
			if err != nil {
				return nil, fmt.Errorf("read %s: %w", path, err)
			}
			appendStateField(&state, "kind", []byte("regular"))
			appendStateField(&state, "content", content)
		case os.ModeSymlink:
			target, err := os.Readlink(fullPath)
			if err != nil {
				return nil, fmt.Errorf("readlink %s: %w", path, err)
			}
			appendStateField(&state, "kind", []byte("symlink"))
			appendStateField(&state, "target", []byte(target))
		default:
			appendStateField(&state, "kind", []byte(info.Mode().Type().String()))
		}
	}
	return state.Bytes(), nil
}

func appendStateField(state *bytes.Buffer, name string, value []byte) {
	_, _ = fmt.Fprintf(state, "%s:%d:", name, len(value))
	_, _ = state.Write(value)
	_ = state.WriteByte(0)
}

func gitPathList(ctx context.Context, root string, arguments ...string) ([]string, error) {
	output, err := gitOutput(ctx, root, arguments...)
	if err != nil {
		return nil, err
	}
	paths := []string{}
	for _, raw := range bytes.Split(output, []byte{0}) {
		if len(raw) != 0 {
			paths = append(paths, string(raw))
		}
	}
	return paths, nil
}

func gitOutput(ctx context.Context, root string, arguments ...string) ([]byte, error) {
	commandArguments := append([]string{"-C", root}, arguments...)
	command := exec.CommandContext(ctx, "git", commandArguments...)
	command.Env = canonicalGitEnvironment(os.Environ())
	output, err := command.CombinedOutput()
	if err != nil {
		if len(output) > 0 {
			return nil, fmt.Errorf("%s", strings.TrimSpace(string(output)))
		}
		return nil, err
	}
	return output, nil
}

func canonicalGitEnvironment(source []string) []string {
	result := make([]string, 0, len(source)+2)
	for _, entry := range source {
		key, _, found := strings.Cut(entry, "=")
		if found && strings.HasPrefix(strings.ToUpper(key), "GIT_") {
			continue
		}
		result = append(result, entry)
	}
	result = append(result, "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL="+os.DevNull)
	return result
}

// RunValidations executes the existing checker gates with fixed commands. The
// hook does not create or update canonical AIDD evidence.
func RunValidations(ctx context.Context, root string) error {
	checkerDirectory := filepath.Join(root, "tools", "aidd", "checker")
	commands := []struct {
		name string
		dir  string
		argv []string
	}{
		{name: "aidd-checker tests", dir: checkerDirectory, argv: []string{"go", "test", "./..."}},
		{name: "aidd-checker artifact gate", dir: checkerDirectory, argv: []string{"go", "run", "./cmd/aidd-checker", "check-all", "--repo-root", root}},
		{name: "aidd phase contract", dir: checkerDirectory, argv: []string{"go", "run", "./cmd/aidd-checker", "validate-phase-contract", "--repo-root", root}},
		{name: "Git diff check", dir: root, argv: []string{"git", "-C", root, "diff", "--no-ext-diff", "HEAD", "--check", "--"}},
	}
	for _, specification := range commands {
		if err := runValidationCommand(ctx, specification.name, specification.dir, specification.argv); err != nil {
			return err
		}
	}
	return nil
}

func runValidationCommand(ctx context.Context, name, directory string, argv []string) error {
	if len(argv) == 0 {
		return &validationFailure{Name: name, Command: argv, Err: errors.New("validation command is empty")}
	}
	command := exec.CommandContext(ctx, argv[0], argv[1:]...)
	command.Dir = directory
	command.Env = canonicalGitEnvironment(os.Environ())
	output, err := command.CombinedOutput()
	if err != nil {
		return &validationFailure{Name: name, Command: argv, Output: shortenOutput(output), Err: err}
	}
	return nil
}

func shortenOutput(output []byte) string {
	text := strings.TrimSpace(string(output))
	if len(text) <= maxValidationOutputLen {
		return text
	}
	return text[:maxValidationOutputLen] + "…"
}

func cacheDirectory(configured string) string {
	if configured != "" {
		return configured
	}
	if configured = os.Getenv("AIDD_HOOK_CACHE_DIR"); configured != "" {
		return configured
	}
	if configured, err := os.UserCacheDir(); err == nil && configured != "" {
		return filepath.Join(configured, "aidd-checker", "codex-hooks")
	}
	return filepath.Join(os.TempDir(), "aidd-checker", "codex-hooks")
}

func hasSuccessfulCache(configured, fingerprint string) (bool, error) {
	path := filepath.Join(cacheDirectory(configured), fingerprint+".json")
	content, err := os.ReadFile(path)
	if err != nil {
		return false, err
	}
	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()
	var entry cacheEntry
	if err := decoder.Decode(&entry); err != nil {
		return false, err
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return false, errors.New("cache contains trailing JSON")
		}
		return false, err
	}
	return entry.Version == cacheSchemaVersion && entry.Fingerprint == fingerprint && entry.Result == cacheResultPassed, nil
}

func writeSuccessfulCache(configured, fingerprint string) error {
	directory := cacheDirectory(configured)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return err
	}
	entry, err := json.Marshal(cacheEntry{Version: cacheSchemaVersion, Fingerprint: fingerprint, Result: cacheResultPassed})
	if err != nil {
		return err
	}
	entry = append(entry, '\n')
	temporary, err := os.CreateTemp(directory, ".aidd-hook-cache-")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(temporaryName)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(entry); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryName, filepath.Join(directory, fingerprint+".json")); err != nil {
		return err
	}
	cleanup = false
	return nil
}

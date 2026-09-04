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

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
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
	SessionID      string `json:"session_id,omitempty"`
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
	IdentityProvider func(context.Context, string, HookInput) (CacheIdentity, error)
}

// CacheIdentity is the complete execution identity a successful validation is
// bound to. Every field is required: an incomplete identity must never reuse a
// successful cache entry.
type CacheIdentity struct {
	SessionID               string
	CanonicalWorktree       string
	GitHEAD                 string
	GoToolchain             string
	NonIgnoredWorktreeState string
}

// Complete reports whether all cache identity components were obtained.
func (identity CacheIdentity) Complete() bool {
	return strings.TrimSpace(identity.SessionID) != "" &&
		strings.TrimSpace(identity.CanonicalWorktree) != "" &&
		strings.TrimSpace(identity.GitHEAD) != "" &&
		strings.TrimSpace(identity.GoToolchain) != "" &&
		strings.TrimSpace(identity.NonIgnoredWorktreeState) != ""
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
		paths, err := ControlPlaneDiff(ctx, root)
		if err != nil {
			return RetryDecision(false, false, "control-plane diff detection failed: "+err.Error()), nil
		}
		if len(paths) == 0 {
			return HookOutput{}, nil
		}
		return handleStopForPaths(ctx, root, input, option, paths)
	}
	paths, err := diffPaths(ctx, root)
	if err != nil {
		return RetryDecision(false, false, "control-plane diff detection failed: "+err.Error()), nil
	}
	return handleStopForPaths(ctx, root, input, option, paths)
}

func handleStopForPaths(ctx context.Context, root string, input HookInput, option Options, paths []string) (HookOutput, error) {
	filteredPaths, err := filterControlPlanePaths(ctx, root, paths)
	if err != nil {
		return RetryDecision(false, false, "control-plane rule matching failed: "+err.Error()), nil
	}
	if len(filteredPaths) == 0 {
		return HookOutput{}, nil
	}
	state, err := controlPlaneState(ctx, root, filteredPaths)
	if err != nil {
		return RetryDecision(false, false, "control-plane state capture failed: "+err.Error()), nil
	}
	identityProvider := option.IdentityProvider
	if identityProvider == nil {
		identityProvider = CacheIdentityForInput
	}
	identity, identityErr := identityProvider(ctx, root, input)
	fingerprint := ControlPlaneFingerprint(filteredPaths, cacheFingerprintState(state, identity))
	cacheDir := option.CacheDir
	if identityErr == nil && CanReuseSuccessfulCache(cacheDir, fingerprint, identity) {
		return HookOutput{}, nil
	}

	validationRunner := option.ValidationRunner
	if validationRunner == nil {
		validationRunner = RunValidations
	}
	if err := validationRunner(ctx, root); err != nil {
		return RetryDecision(false, false, err.Error()), nil
	}
	if identityErr == nil && identity.Complete() {
		_ = writeSuccessfulCache(cacheDir, fingerprint)
	}
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
// HandleStop supplies both the current Git/file state and the complete cache
// identity, so a successful result cannot cross sessions, worktrees, commits,
// toolchains, or non-ignored worktree states. The path-only form remains useful
// for path identity tests and callers that do not have a repository snapshot.
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

func cacheFingerprintState(controlState []byte, identity CacheIdentity) []byte {
	var state bytes.Buffer
	appendStateField(&state, "control-plane", controlState)
	appendStateField(&state, "session", []byte(identity.SessionID))
	appendStateField(&state, "canonical-worktree", []byte(identity.CanonicalWorktree))
	appendStateField(&state, "git-head", []byte(identity.GitHEAD))
	appendStateField(&state, "go-toolchain", []byte(identity.GoToolchain))
	appendStateField(&state, "non-ignored-worktree-state", []byte(identity.NonIgnoredWorktreeState))
	return state.Bytes()
}

// CanReuseSuccessfulCache is the single cache reuse gate. Missing identity
// components deliberately return false even when a matching cache file exists.
func CanReuseSuccessfulCache(configured, fingerprint string, identities ...CacheIdentity) bool {
	if len(identities) != 1 || !identities[0].Complete() {
		return false
	}
	cached, err := hasSuccessfulCache(configured, fingerprint)
	return err == nil && cached
}

// CacheIdentityForInput captures all identity components needed to reuse a
// successful Stop validation. It reads no Goal, phase, transcript, or AIDD
// artifact state. An unavailable component is returned as an error so callers
// can continue validation without reusing or writing a cache entry.
func CacheIdentityForInput(ctx context.Context, root string, input HookInput) (CacheIdentity, error) {
	identity := CacheIdentity{SessionID: strings.TrimSpace(input.SessionID)}
	if identity.SessionID == "" {
		return identity, errors.New("Codex session identity is unavailable")
	}
	canonical, err := canonicalWorktree(root)
	if err != nil {
		return identity, fmt.Errorf("canonical worktree identity unavailable: %w", err)
	}
	identity.CanonicalWorktree = filepath.ToSlash(canonical)
	identity.GitHEAD, err = gitHeadIdentity(ctx, canonical)
	if err != nil {
		return identity, fmt.Errorf("Git HEAD identity unavailable: %w", err)
	}
	identity.GoToolchain, err = goToolchainIdentity(ctx)
	if err != nil {
		return identity, fmt.Errorf("Go toolchain identity unavailable: %w", err)
	}
	state, err := nonIgnoredWorktreeState(ctx, canonical)
	if err != nil {
		return identity, fmt.Errorf("non-ignored worktree identity unavailable: %w", err)
	}
	digest := sha256.Sum256(state)
	identity.NonIgnoredWorktreeState = hex.EncodeToString(digest[:])
	return identity, nil
}

func canonicalWorktree(root string) (string, error) {
	if strings.TrimSpace(root) == "" {
		return "", errors.New("repository root is empty")
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	canonical, err := filepath.EvalSymlinks(absolute)
	if err != nil {
		return "", err
	}
	return filepath.Clean(canonical), nil
}

func gitHeadIdentity(ctx context.Context, root string) (string, error) {
	output, err := gitOutput(ctx, root, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return "", err
	}
	head := strings.TrimSpace(string(output))
	if head == "" {
		return "", errors.New("Git returned an empty HEAD")
	}
	return head, nil
}

func goToolchainIdentity(ctx context.Context) (string, error) {
	command := exec.CommandContext(ctx, "go", "env", "GOVERSION")
	command.Env = canonicalGitEnvironment(os.Environ())
	output, err := command.Output()
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(output))
	if version == "" {
		return "", errors.New("go env GOVERSION returned an empty value")
	}
	return version, nil
}

func nonIgnoredWorktreeState(ctx context.Context, root string) ([]byte, error) {
	trackedDiff, err := gitOutput(ctx, root, "diff", "--no-ext-diff", "--binary", "--full-index", "--no-color", "HEAD", "--")
	if err != nil {
		return nil, fmt.Errorf("git worktree diff: %w", err)
	}
	untracked, err := gitPathList(ctx, root, "ls-files", "--others", "--exclude-standard", "-z", "--")
	if err != nil {
		return nil, fmt.Errorf("git untracked paths: %w", err)
	}
	sort.Strings(untracked)
	var state bytes.Buffer
	appendStateField(&state, "version", []byte("AIDD-codex-hooks-worktree-state-v1"))
	appendStateField(&state, "tracked-diff", trackedDiff)
	for _, path := range untracked {
		path = filepath.ToSlash(strings.TrimPrefix(strings.TrimSpace(path), "./"))
		if path == "" {
			continue
		}
		appendStateField(&state, "path", []byte(path))
		fullPath := filepath.Join(root, filepath.FromSlash(path))
		info, err := os.Lstat(fullPath)
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("untracked path %s disappeared", path)
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
			digest := sha256.Sum256(content)
			appendStateField(&state, "kind", []byte("regular"))
			appendStateField(&state, "content-sha256", []byte(hex.EncodeToString(digest[:])))
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

// ControlPlaneRuleMatcherはcanonical rule-mapからAIDD制御面pathを解決する。
// rule-map自身は常にbootstrap対象とし、壊れた場合や削除された場合もStop検証を発火させる。
type ControlPlaneRuleMatcher struct {
	loaded *rules.Loaded
}

// NewControlPlaneRuleMatcherはchecker既存のrepository snapshotとpath matcherで
// canonical rule-mapを読み込む。
func NewControlPlaneRuleMatcher(ctx context.Context, root string) (*ControlPlaneRuleMatcher, error) {
	snapshot, err := repository.Open(ctx, root)
	if err != nil {
		return nil, err
	}
	defer snapshot.Close()
	loaded, err := rules.Load(snapshot, rules.DefaultPath)
	if err != nil {
		return nil, err
	}
	return &ControlPlaneRuleMatcher{loaded: loaded}, nil
}

func normalizeControlPlanePath(path string) string {
	return filepath.ToSlash(strings.TrimPrefix(strings.TrimSpace(path), "./"))
}

func normalizedControlPlanePaths(paths []string) []string {
	unique := make(map[string]struct{}, len(paths))
	for _, path := range paths {
		normalized := normalizeControlPlanePath(path)
		if normalized != "" {
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

func (matcher *ControlPlaneRuleMatcher) match(path string) (bool, error) {
	path = normalizeControlPlanePath(path)
	if path == "" {
		return false, nil
	}
	if path == rules.DefaultPath {
		return true, nil
	}
	if matcher == nil || matcher.loaded == nil {
		return false, errors.New("control-plane rule matcher is unavailable")
	}
	_, selected, err := rules.ResolvePath(matcher.loaded, path)
	if err != nil {
		return false, err
	}
	for _, id := range selected {
		if id == "ai-driven.checker" {
			return true, nil
		}
	}
	return false, nil
}

// Matchはcanonical ai-driven.checker ruleがpathを選択するか返す。
// エラーは非該当として扱うため、fail-closedが必要な呼び出し側はFilterを使う。
func (matcher *ControlPlaneRuleMatcher) Match(path string) bool {
	matched, err := matcher.match(path)
	return err == nil && matched
}

// Filterはpathから制御面だけをソートして返す。rule-map読込またはpath解決の失敗を返し、
// Stop検証が黙って省略されないようにする。
func (matcher *ControlPlaneRuleMatcher) Filter(paths []string) ([]string, error) {
	result := []string{}
	for _, path := range normalizedControlPlanePaths(paths) {
		matched, err := matcher.match(path)
		if err != nil {
			return nil, err
		}
		if matched {
			result = append(result, path)
		}
	}
	return result, nil
}

// IsControlPlanePathはrepository-relative pathがcanonical rule-mapの対象か返す。
// repositoryから実行する呼び出し側向けの互換関数であり、本番filteringはroot-aware matcherを使う。
func IsControlPlanePath(path string) bool {
	if normalizeControlPlanePath(path) == rules.DefaultPath {
		return true
	}
	root, err := os.Getwd()
	if err != nil {
		return false
	}
	root, err = gitRepositoryRoot(context.Background(), root)
	if err != nil {
		return false
	}
	matcher, err := NewControlPlaneRuleMatcher(context.Background(), root)
	return err == nil && matcher.Match(path)
}

func filterControlPlanePaths(ctx context.Context, root string, paths []string) ([]string, error) {
	normalized := normalizedControlPlanePaths(paths)
	for _, path := range normalized {
		if path == rules.DefaultPath {
			// 編集されたrule-mapがparse不能でもbootstrap pathは保持し、既存gateを発火させる。
			bootstrap := []string{path}
			matcher, err := NewControlPlaneRuleMatcher(ctx, root)
			if err != nil {
				return bootstrap, nil
			}
			filtered, filterErr := matcher.Filter(normalized)
			if filterErr != nil {
				return bootstrap, nil
			}
			return filtered, nil
		}
	}
	matcher, err := NewControlPlaneRuleMatcher(ctx, root)
	if err != nil {
		return nil, err
	}
	return matcher.Filter(normalized)
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
	return filterControlPlanePaths(ctx, root, append(tracked, untracked...))
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
	paths = normalizedControlPlanePaths(paths)
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

package codexhooks

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestStopEvaluatesOnlyRelevantControlPlaneDiff(t *testing.T) {
	root := newHookRepository(t)
	cacheDir := filepath.Join(t.TempDir(), "cache")
	validationCalls := 0
	options := Options{
		CacheDir: cacheDir,
		ValidationRunner: func(context.Context, string) error {
			validationCalls++
			return nil
		},
	}

	writeHookFile(t, root, "README.md", "ordinary change\n")
	output, err := HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root}, options)
	if err != nil {
		t.Fatal(err)
	}
	if output != (HookOutput{}) || validationCalls != 0 {
		t.Fatalf("ordinary diff triggered validation: output=%+v calls=%d", output, validationCalls)
	}

	writeHookFile(t, root, ".codex/hooks.json", "{\"hooks\":{\"Stop\":[]}}\n")
	output, err = HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root}, options)
	if err != nil {
		t.Fatal(err)
	}
	if output != (HookOutput{}) || validationCalls != 1 {
		t.Fatalf("control-plane diff did not trigger exactly once: output=%+v calls=%d", output, validationCalls)
	}
}

func TestStopEvaluatesAIDDAgentConfigurationDiff(t *testing.T) {
	root := newHookRepository(t)
	cacheDir := filepath.Join(t.TempDir(), "cache")
	validationCalls := 0
	options := Options{
		CacheDir: cacheDir,
		ValidationRunner: func(context.Context, string) error {
			validationCalls++
			return nil
		},
	}
	writeHookFile(t, root, ".codex/config.toml", "[agents.aidd-build]\nconfig_file = \"./agents/aidd-build.toml\"\n")
	if output, err := HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root}, options); err != nil || output != (HookOutput{}) {
		t.Fatalf(".codex/config.toml did not trigger validation: output=%+v err=%v", output, err)
	}
	writeHookFile(t, root, ".codex/agents/aidd-build.toml", "name = \"aidd-build\"\n")
	if output, err := HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root}, options); err != nil || output != (HookOutput{}) {
		t.Fatalf(".codex/agents change did not trigger validation: output=%+v err=%v", output, err)
	}
	if validationCalls != 2 {
		t.Fatalf("expected agent configuration changes to trigger validation twice, got %d calls", validationCalls)
	}
}

func TestControlPlanePathClassificationIncludesAIDDAgentConfiguration(t *testing.T) {
	tests := map[string]bool{
		".codex/hooks.json":                               true,
		".codex/config.toml":                              true,
		".codex/agents/aidd-build.toml":                   true,
		".agents/skills/aidd-cycle/SKILL.md":              true,
		".agents/skills/goal-setting/SKILL.md":            true,
		"tools/aidd/checker/internal/codexhooks/hooks.go": true,
		"docs/harness/rule-map.json":                      true,
		"docs/ai-driven-development/workspaces/1697-codex-hooks-aidd-40d66f9e5598/.aidd/build-verification.json": false,
		"README.md": false,
	}
	for path, want := range tests {
		if got := IsControlPlanePath(path); got != want {
			t.Errorf("IsControlPlanePath(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestControlPlanePathsFollowRuleMap(t *testing.T) {
	root := newHookRepository(t)
	cacheDir := filepath.Join(t.TempDir(), "cache")
	validationCalls := 0
	options := Options{
		CacheDir: cacheDir,
		ValidationRunner: func(context.Context, string) error {
			validationCalls++
			return nil
		},
	}

	writeHookFile(t, root, "README.md", "ordinary change\n")
	if output, err := HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root}, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("ordinary path handling failed: output=%+v err=%v", output, err)
	}
	if validationCalls != 0 {
		t.Fatalf("ordinary path triggered validation before rule-map update: %d calls", validationCalls)
	}

	const addedPath = "custom/aidd-control.txt"
	writeHookRuleMap(t, root, addedPath)
	writeHookFile(t, root, addedPath, "control-plane change\n")
	if output, err := HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root}, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("rule-map-added path handling failed: output=%+v err=%v", output, err)
	}
	if validationCalls != 1 {
		t.Fatalf("rule-map-added path did not trigger exactly once: %d calls", validationCalls)
	}
}

func TestStopSkipsCachedFingerprintAndPreventsReentry(t *testing.T) {
	root := newHookRepository(t)
	writeHookFile(t, root, ".codex/hooks.json", "{\"hooks\":{\"Stop\":[]}}\n")
	validationCalls := 0
	options := Options{
		CacheDir: filepath.Join(t.TempDir(), "cache"),
		IdentityProvider: func(_ context.Context, root string, input HookInput) (CacheIdentity, error) {
			return testCacheIdentity(root, input.SessionID), nil
		},
		ValidationRunner: func(context.Context, string) error {
			validationCalls++
			return nil
		},
	}
	input := HookInput{HookEventName: HookEventStop, Cwd: root, SessionID: "session-1"}
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("first validation failed: output=%+v err=%v", output, err)
	}
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("cached validation failed: output=%+v err=%v", output, err)
	}
	input.StopHookActive = true
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("re-entry was not allowed to finish: output=%+v err=%v", output, err)
	}
	if validationCalls != 1 {
		t.Fatalf("expected one validation call, got %d", validationCalls)
	}
}

func TestStopRevalidatesChangedBytesForSamePath(t *testing.T) {
	root := newHookRepository(t)
	cacheDir := filepath.Join(t.TempDir(), "cache")
	validationCalls := 0
	options := Options{
		CacheDir: cacheDir,
		IdentityProvider: func(_ context.Context, root string, input HookInput) (CacheIdentity, error) {
			return testCacheIdentity(root, input.SessionID), nil
		},
		ValidationRunner: func(context.Context, string) error {
			validationCalls++
			return nil
		},
	}
	input := HookInput{HookEventName: HookEventStop, Cwd: root, SessionID: "session-1"}

	writeHookFile(t, root, ".codex/hooks.json", "{\"hooks\":{\"Stop\":[]}}\n")
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("first validation failed: output=%+v err=%v", output, err)
	}
	writeHookFile(t, root, ".codex/hooks.json", "{\"hooks\":{\"Stop\":[{\"matcher\":\"changed\"}]}}\n")
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("changed content was not revalidated: output=%+v err=%v", output, err)
	}
	if validationCalls != 2 {
		t.Fatalf("expected changed bytes to produce a new fingerprint, got %d validation calls", validationCalls)
	}
}

func TestStopResolvesRepositoryRootFromSubdirectory(t *testing.T) {
	root := newHookRepository(t)
	subdirectory := filepath.Join(root, "nested", "session")
	if err := os.MkdirAll(subdirectory, 0o755); err != nil {
		t.Fatal(err)
	}
	writeHookFile(t, root, ".codex/hooks.json", "{\"hooks\":{\"Stop\":[]}}\n")
	var validationRoot string
	options := Options{
		CacheDir: filepath.Join(t.TempDir(), "cache"),
		ValidationRunner: func(_ context.Context, gotRoot string) error {
			validationRoot = gotRoot
			return nil
		},
	}
	if output, err := HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: subdirectory}, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("subdirectory Stop failed: output=%+v err=%v", output, err)
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		t.Fatal(err)
	}
	if validationRoot != resolvedRoot {
		t.Fatalf("validation root = %q, want repository root %q", validationRoot, resolvedRoot)
	}
}

func TestSessionStartCompactInjectsAIDDInvariants(t *testing.T) {
	output := HandleSessionStart(HookInput{HookEventName: HookEventSessionStart, Source: SessionStartCompact})
	if output.Decision != "" || output.Reason != "" {
		t.Fatalf("compact SessionStart returned a Stop decision: %+v", output)
	}
	if output.HookSpecificOutput == nil || output.HookSpecificOutput.HookEventName != HookEventSessionStart {
		t.Fatalf("compact SessionStart returned no official hook-specific output: %+v", output)
	}
	contextText := output.HookSpecificOutput.AdditionalContext
	for _, invariant := range []string{
		"現在Goal",
		"親agent",
		"上流成果物",
		"Build / Verify",
		"Ship",
		"Learn",
	} {
		if !strings.Contains(contextText, invariant) {
			t.Errorf("compact context does not contain %q: %q", invariant, contextText)
		}
	}
	if other := HandleSessionStart(HookInput{HookEventName: HookEventSessionStart, Source: "startup"}); other != (HookOutput{}) {
		t.Fatalf("non-compact SessionStart injected context: %+v", other)
	}
}

func TestSessionStartCompactUsesExactOfficialJSONShape(t *testing.T) {
	output := HandleSessionStart(HookInput{HookEventName: HookEventSessionStart, Source: SessionStartCompact})
	serialized, err := json.Marshal(output)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"AIDD工程不変条件:\n- 現在Goalを継続する。\n- Goalの所有は親agentが担う。\n- 上流成果物はread-onlyとして扱う。\n- Build / Verifyの次はShipへ進む。\n- Learnは自動実行しない。"}}`
	if string(serialized) != want {
		t.Fatalf("SessionStart JSON = %s, want %s", serialized, want)
	}
}

func TestCompactContextContainsOnlyAIDDInvariants(t *testing.T) {
	contextText := CompactContext()
	lines := strings.Split(contextText, "\n")
	if len(lines) != 6 {
		t.Fatalf("expected heading plus five invariants, got %d lines: %q", len(lines), contextText)
	}
	for _, forbidden := range []string{"Issue本文", "requirements.json", "design-doc.json", "transcript", "現在のIssue"} {
		if strings.Contains(contextText, forbidden) {
			t.Errorf("compact context contains forbidden content %q", forbidden)
		}
	}
}

func TestStopReturnsTargetedValidationDecisions(t *testing.T) {
	root := newHookRepository(t)
	writeHookFile(t, root, ".codex/hooks.json", "{\"hooks\":{\"Stop\":[]}}\n")
	failed := errors.New("validation aidd-checker artifact gate failed")
	options := Options{
		CacheDir:         filepath.Join(t.TempDir(), "cache"),
		ValidationRunner: func(context.Context, string) error { return failed },
	}
	output, err := HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root}, options)
	if err != nil {
		t.Fatal(err)
	}
	if output.Decision != HookDecisionBlock || !strings.Contains(output.Reason, "validation") {
		t.Fatalf("failed validation was not blocked with a reason: %+v", output)
	}
	output, err = HandleStop(context.Background(), HookInput{HookEventName: HookEventStop, Cwd: root, StopHookActive: true}, options)
	if err != nil || output != (HookOutput{}) {
		t.Fatalf("active Stop hook repeated the block: output=%+v err=%v", output, err)
	}
}

func TestHooksDisabledLeavesWorkflowIndependent(t *testing.T) {
	config, err := os.ReadFile(filepath.Join(repositoryRoot(t), ".codex", "hooks.json"))
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Hooks map[string][]struct {
			Matcher string `json:"matcher"`
			Hooks   []struct {
				Type    string `json:"type"`
				Command string `json:"command"`
			} `json:"hooks"`
		} `json:"hooks"`
	}
	if err := json.Unmarshal(config, &document); err != nil {
		t.Fatal(err)
	}
	if len(document.Hooks[HookEventStop]) != 1 || len(document.Hooks[HookEventSessionStart]) != 1 {
		t.Fatalf("unexpected hooks configuration: %+v", document.Hooks)
	}
	for event, entries := range document.Hooks {
		for _, entry := range entries {
			for _, hook := range entry.Hooks {
				if hook.Type != "command" || !strings.Contains(hook.Command, "aidd-hooks") {
					t.Fatalf("%s contains a non-runner hook: %+v", event, hook)
				}
			}
		}
	}
	if output, err := Handle(context.Background(), HookInput{HookEventName: "UnknownEvent"}); err != nil || output != (HookOutput{}) {
		t.Fatalf("unknown/disabled hook path changed workflow behavior: output=%+v err=%v", output, err)
	}
}

func TestHookConfigurationUsesGitRootModulePath(t *testing.T) {
	config, err := os.ReadFile(filepath.Join(repositoryRoot(t), ".codex", "hooks.json"))
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Hooks map[string][]struct {
			Matcher string `json:"matcher"`
			Hooks   []struct {
				Type    string `json:"type"`
				Command string `json:"command"`
			} `json:"hooks"`
		} `json:"hooks"`
	}
	if err := json.Unmarshal(config, &document); err != nil {
		t.Fatal(err)
	}
	wantCommand := `repo_root="$(git rev-parse --show-toplevel)" && exec go run -C "$repo_root/tools/aidd/checker" ./cmd/aidd-hooks`
	for _, event := range []string{HookEventSessionStart, HookEventStop} {
		entries := document.Hooks[event]
		if len(entries) != 1 || len(entries[0].Hooks) != 1 {
			t.Fatalf("%s hook shape = %+v", event, entries)
		}
		if event == HookEventSessionStart && entries[0].Matcher != SessionStartCompact {
			t.Fatalf("SessionStart matcher = %q, want %q", entries[0].Matcher, SessionStartCompact)
		}
		if event == HookEventStop && entries[0].Matcher != "" {
			t.Fatalf("Stop matcher = %q, want empty", entries[0].Matcher)
		}
		hook := entries[0].Hooks[0]
		if hook.Type != "command" || hook.Command != wantCommand {
			t.Fatalf("%s hook = %+v, want command %q", event, hook, wantCommand)
		}
	}
}

func TestHookRegressionMatrix(t *testing.T) {
	tests := []struct {
		name         string
		input        HookInput
		paths        []string
		validation   error
		wantDecision string
		wantCalls    int
	}{
		{name: "irrelevant", paths: []string{"README.md"}, wantCalls: 0},
		{name: "relevant success", paths: []string{"tools/aidd/checker/internal/codexhooks/hooks.go"}, wantCalls: 1},
		{name: "relevant failure", paths: []string{"tools/aidd/checker/internal/codexhooks/hooks.go"}, validation: errors.New("validation failed"), wantDecision: HookDecisionBlock, wantCalls: 1},
		{name: "reentry", input: HookInput{StopHookActive: true}, paths: []string{"tools/aidd/checker/internal/codexhooks/hooks.go"}, wantCalls: 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			calls := 0
			options := Options{
				CacheDir:  filepath.Join(t.TempDir(), "cache"),
				DiffPaths: func(context.Context, string) ([]string, error) { return test.paths, nil },
				ValidationRunner: func(context.Context, string) error {
					calls++
					return test.validation
				},
			}
			test.input.HookEventName = HookEventStop
			output, err := HandleStop(context.Background(), test.input, options)
			if err != nil {
				t.Fatal(err)
			}
			if output.Decision != test.wantDecision || calls != test.wantCalls {
				t.Fatalf("unexpected matrix result: output=%+v calls=%d", output, calls)
			}
		})
	}

	compact, err := Handle(context.Background(), HookInput{HookEventName: HookEventSessionStart, Source: SessionStartCompact})
	if err != nil {
		t.Fatal(err)
	}
	if compact.HookSpecificOutput == nil || compact.HookSpecificOutput.AdditionalContext == "" {
		t.Fatal("compact event did not inject context")
	}
}

func TestControlPlaneFingerprintIsStable(t *testing.T) {
	left := ControlPlaneFingerprint([]string{"tools/aidd/checker", ".codex/hooks.json", "tools/aidd/checker"})
	right := ControlPlaneFingerprint([]string{".codex/hooks.json", "tools/aidd/checker"})
	if left != right || len(left) != 64 {
		t.Fatalf("fingerprint is not stable: left=%q right=%q", left, right)
	}
}

func TestStopCacheIdentityRequiresExactExecutionState(t *testing.T) {
	root := newHookRepository(t)
	cacheDir := filepath.Join(t.TempDir(), "cache")
	identity := testCacheIdentity(root, "session-1")
	validationCalls := 0
	options := Options{
		CacheDir: cacheDir,
		IdentityProvider: func(context.Context, string, HookInput) (CacheIdentity, error) {
			return identity, nil
		},
		DiffPaths: func(context.Context, string) ([]string, error) {
			return []string{".codex/hooks.json"}, nil
		},
		ValidationRunner: func(context.Context, string) error {
			validationCalls++
			return nil
		},
	}
	input := HookInput{HookEventName: HookEventStop, Cwd: root, SessionID: "session-1"}
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("first validation failed: output=%+v err=%v", output, err)
	}
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("exact identity did not reuse cache: output=%+v err=%v", output, err)
	}
	if validationCalls != 1 {
		t.Fatalf("exact identity should reuse successful cache, got %d validation calls", validationCalls)
	}

	identity.NonIgnoredWorktreeState = ""
	if output, err := HandleStop(context.Background(), input, options); err != nil || output != (HookOutput{}) {
		t.Fatalf("missing identity should still allow validation: output=%+v err=%v", output, err)
	}
	if validationCalls != 2 {
		t.Fatalf("missing identity reused successful cache, got %d validation calls", validationCalls)
	}
}

func TestStopRevalidatesWhenCacheIdentityChanges(t *testing.T) {
	components := []struct {
		name   string
		change func(*CacheIdentity)
	}{
		{name: "session", change: func(identity *CacheIdentity) { identity.SessionID = "session-2" }},
		{name: "canonical worktree", change: func(identity *CacheIdentity) { identity.CanonicalWorktree = "/another/worktree" }},
		{name: "Git HEAD", change: func(identity *CacheIdentity) { identity.GitHEAD = "another-head" }},
		{name: "Go toolchain", change: func(identity *CacheIdentity) { identity.GoToolchain = "go1.28.0" }},
		{name: "non-ignored worktree state", change: func(identity *CacheIdentity) { identity.NonIgnoredWorktreeState = "another-state" }},
	}
	for _, component := range components {
		t.Run(component.name, func(t *testing.T) {
			root := newHookRepository(t)
			cacheDir := filepath.Join(t.TempDir(), "cache")
			identity := testCacheIdentity(root, "session-1")
			validationCalls := 0
			options := Options{
				CacheDir: cacheDir,
				IdentityProvider: func(context.Context, string, HookInput) (CacheIdentity, error) {
					return identity, nil
				},
				DiffPaths: func(context.Context, string) ([]string, error) {
					return []string{".codex/hooks.json"}, nil
				},
				ValidationRunner: func(context.Context, string) error {
					validationCalls++
					return nil
				},
			}
			input := HookInput{HookEventName: HookEventStop, Cwd: root, SessionID: "session-1"}
			if _, err := HandleStop(context.Background(), input, options); err != nil {
				t.Fatal(err)
			}
			if _, err := HandleStop(context.Background(), input, options); err != nil {
				t.Fatal(err)
			}
			if validationCalls != 1 {
				t.Fatalf("unchanged identity did not reuse cache, got %d validation calls", validationCalls)
			}
			component.change(&identity)
			if _, err := HandleStop(context.Background(), input, options); err != nil {
				t.Fatal(err)
			}
			if validationCalls != 2 {
				t.Fatalf("changed %s reused successful cache, got %d validation calls", component.name, validationCalls)
			}
		})
	}
}

func newHookRepository(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	runGitForHookTest(t, root, "init", "-q")
	runGitForHookTest(t, root, "config", "user.email", "aidd-hooks@example.invalid")
	runGitForHookTest(t, root, "config", "user.name", "AIDD Hooks")
	writeHookFile(t, root, "README.md", "baseline\n")
	writeHookFile(t, root, ".codex/hooks.json", "{\"hooks\":{}}\n")
	writeHookRuleMap(t, root)
	runGitForHookTest(t, root, "add", ".")
	runGitForHookTest(t, root, "commit", "-qm", "baseline")
	return root
}

func writeHookRuleMap(t *testing.T, root string, extraPaths ...string) {
	t.Helper()
	paths, err := json.Marshal(append([]string{".codex/**", "tools/aidd/**", "docs/harness/rule-map.json"}, extraPaths...))
	if err != nil {
		t.Fatal(err)
	}
	content := `{"version":2,"review_routing":{"governed_paths":["apps/**"],"surfaces":[{"id":"apps","paths":["apps/**"],"required_rules":["ai-driven.checker"]}]},"rules":[{"id":"ai-driven.checker","file":"docs/checker.md","applies_to":{"paths":` + string(paths) + `,"domains":[],"activities":[],"topics":[]},"depends_on":[],"overrides":[],"priority":1}]}` + "\n"
	writeHookFile(t, root, "docs/harness/rule-map.json", content)
}

func writeHookFile(t *testing.T, root, relative, content string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func runGitForHookTest(t *testing.T, root string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", root}, arguments...)...)
	command.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", arguments, err, output)
	}
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	workingDirectory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	root := workingDirectory
	for {
		if _, err := os.Stat(filepath.Join(root, ".git")); err == nil {
			return root
		}
		parent := filepath.Dir(root)
		if parent == root {
			t.Fatal("repository root not found")
		}
		root = parent
	}
}

func testCacheIdentity(root, sessionID string) CacheIdentity {
	return CacheIdentity{
		SessionID:               sessionID,
		CanonicalWorktree:       root,
		GitHEAD:                 "head-1",
		GoToolchain:             "go-test-1",
		NonIgnoredWorktreeState: "state-1",
	}
}

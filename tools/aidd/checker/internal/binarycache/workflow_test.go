package binarycache

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"go.yaml.in/yaml/v3"
)

func quote(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'" }

func TestRealCheckerReuseAndSchemaRejection(t *testing.T) {
	root, err := filepath.Abs("../../../../..")
	if err != nil {
		t.Fatal(err)
	}
	id, _, err := capture(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	copyRoot := t.TempDir()
	for _, in := range id.Inputs {
		data, err := regular(root, in.Path)
		if err != nil {
			t.Fatal(err)
		}
		put(t, copyRoot, in.Path, string(data))
	}
	realGo, err := exec.LookPath("go")
	if err != nil {
		t.Fatal(err)
	}
	bin := t.TempDir()
	trace := filepath.Join(bin, "builds")
	wrapper := "#!/bin/sh\nif [ \"$1\" = build ]; then echo build >> " + quote(trace) + "; fi\nexec " + quote(realGo) + " \"$@\"\n"
	if err := os.WriteFile(filepath.Join(bin, "go"), []byte(wrapper), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("GOFLAGS", "-overlay=/nonexistent-overlay.json")
	t.Setenv("GOWORK", "/nonexistent-workspace")
	cache := t.TempDir()
	first, err := prepareChecker(context.Background(), copyRoot, cache)
	if err != nil {
		t.Fatal(err)
	}
	put(t, copyRoot, ".aidd/tasks/other/task.json", `{"id":"other","body":"different"}`)
	put(t, copyRoot, "apps/web/src/other.tsx", "application change")
	second, err := prepareChecker(context.Background(), copyRoot, cache)
	if err != nil {
		t.Fatal(err)
	}
	traceBytes, err := os.ReadFile(trace)
	if err != nil {
		t.Fatal(err)
	}
	if first != second || string(traceBytes) != "build\n" {
		t.Fatalf("checker rebuilt: %q", traceBytes)
	}
	if out, err := exec.Command(second, "version").CombinedOutput(); err != nil {
		t.Fatalf("checker cannot run: %s %v", out, err)
	}
	for _, args := range [][]string{{"init", "-q"}, {"config", "user.email", "test@example.com"}, {"config", "user.name", "Test"}, {"add", "."}, {"commit", "-qm", "fixture"}} {
		cmd := exec.Command("git", args...)
		cmd.Dir = copyRoot
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git fixture: %s %v", out, err)
		}
	}
	source := filepath.Join(t.TempDir(), "invalid.json")
	if err := os.WriteFile(source, []byte(`{"schema_version":999,"kind":"development","action":"execute"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command(second, "task-start", "--repo-root", copyRoot, "--source", source).CombinedOutput()
	if err == nil || !strings.Contains(string(out), "schema_version") {
		t.Fatalf("invalid schema accepted or wrong failure: %s %v", out, err)
	}
}

func TestCIUsesPrepareFromBaseOnly(t *testing.T) {
	data, err := os.ReadFile("../../../../../.github/workflows/aidd_checker_ci.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		Jobs map[string]struct{ Steps []struct{ Name, Run string } }
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	script := ""
	for _, step := range workflow.Jobs["verify"].Steps {
		if step.Name == "Verify delivery with the base protocol" {
			script = step.Run
		}
	}
	if script == "" {
		t.Fatal("missing CI delivery")
	}
	root := t.TempDir()
	git := func(args ...string) string {
		t.Helper()
		c := exec.Command("git", args...)
		c.Dir = root
		b, e := c.CombinedOutput()
		if e != nil {
			t.Fatalf("git: %s %v", b, e)
		}
		return strings.TrimSpace(string(b))
	}
	git("init", "-q")
	git("config", "user.email", "test@example.com")
	git("config", "user.name", "Test")
	put(t, root, "docs/ai-driven-development/contracts/protocol.json", "{}")
	put(t, root, "tools/aidd/checker/cmd/aidd-prepare/main.go", "base prepare")
	put(t, root, "tools/aidd/checker/source-marker", "trusted base")
	git("add", ".")
	git("commit", "-qm", "base")
	base := git("rev-parse", "HEAD")
	put(t, root, "tools/aidd/checker/source-marker", "untrusted candidate")
	git("add", ".")
	git("commit", "-qm", "candidate")
	head := git("rev-parse", "HEAD")
	bin := t.TempDir()
	trace := filepath.Join(bin, "trace")
	checker := filepath.Join(bin, "trusted-checker")
	body := "#!/bin/sh\n[ \"$1\" = ci-check ] || exit 91\nprintf '%s\\n' \"$@\" >> " + quote(trace) + "\n"
	if err := os.WriteFile(checker, []byte(body), 0o700); err != nil {
		t.Fatal(err)
	}
	fakeGo := `#!/bin/sh
set -eu
[ "$GOENV" = off ] && [ "$GOWORK" = off ] && [ -z "$GOFLAGS" ] && [ "$GOTOOLCHAIN" = local ]
[ "$1" = run ] && [ "$2" = -C ] && [ "$4" = ./cmd/aidd-prepare ]
cat "$3/source-marker" > ` + quote(trace) + "\necho " + quote(checker) + "\n"
	if err := os.WriteFile(filepath.Join(bin, "go"), []byte(fakeGo), 0o700); err != nil {
		t.Fatal(err)
	}
	c := exec.Command("bash", "-c", script)
	c.Dir = root
	c.Env = append(os.Environ(), "PATH="+bin+":"+os.Getenv("PATH"), "PR_AUTHOR_LOGIN=human", "PR_BASE_SHA="+base, "PR_HEAD_SHA="+head, "GITHUB_WORKSPACE="+root, "GOFLAGS=-overlay=untrusted", "GOWORK=/untrusted")
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("CI: %s %v", out, err)
	}
	out, err := os.ReadFile(trace)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(out), "trusted baseci-check\n") || !strings.Contains(string(out), "--base\n"+base+"\n") {
		t.Fatalf("wrong trusted source: %s", out)
	}
}

func TestDocumentedEntryNormalizesBootstrap(t *testing.T) {
	b, err := os.ReadFile("../../../../../docs/ai-driven-development/aidd-checker-operations.md")
	if err != nil {
		t.Fatal(err)
	}
	line := ""
	for _, l := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(l, "checker_binary=$(") {
			line = l
		}
	}
	if line == "" {
		t.Fatal("missing documented entry")
	}
	bin := t.TempDir()
	fake := `#!/bin/sh
[ "$GOENV" = off ] && [ "$GOWORK" = off ] && [ -z "$GOFLAGS" ] && [ "$GOTOOLCHAIN" = local ] || exit 91
printf /verified/checker
`
	if err := os.WriteFile(filepath.Join(bin, "go"), []byte(fake), 0o700); err != nil {
		t.Fatal(err)
	}
	c := exec.Command("sh", "-ec", line+"\nprintf '%s' \"$checker_binary\"")
	c.Env = append(os.Environ(), "PATH="+bin+":"+os.Getenv("PATH"), "GOFLAGS=-overlay=untrusted", "GOWORK=/untrusted", "GOENV=/untrusted", "GOTOOLCHAIN=untrusted")
	b, err = c.CombinedOutput()
	if err != nil || string(b) != "/verified/checker" {
		t.Fatalf("entry: %s %v", b, err)
	}
}

// manifestは構築元と使用binaryの対応を外部から確認できる。
func TestManifestRecordsBuildInputs(t *testing.T) {
	root, cache := fixture(t)
	path, err := prepare(context.Background(), root, cache, []string{"host"}, func(p string) error { return os.WriteFile(p, []byte("binary"), 0o700) })
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(filepath.Dir(path), "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var m manifest
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	if len(m.Identity.Inputs) == 0 || m.BinarySHA256 != digest([]byte("binary")) || m.Key != filepath.Base(filepath.Dir(path)) {
		t.Fatal("missing provenance")
	}
}

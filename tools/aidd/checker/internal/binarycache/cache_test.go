package binarycache

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func fixture(t *testing.T) (string, string) {
	t.Helper()
	root := t.TempDir()
	for path, content := range map[string]string{
		"tools/aidd/checker/go.mod": "module example\n", "tools/aidd/checker/go.sum": "sum", "tools/aidd/checker/main.go": "source",
		"docs/ai-driven-development/contracts/protocol.json": "{}", "docs/ai-driven-development/contracts/verification-profiles.json": "{}", "docs/ai-driven-development/contracts/requirements-sections.json": "{}",
		"docs/harness/rule-map.json": `{"rules":[{"file":"docs/rule.md"}]}`, "docs/rule.md": "rule",
	} {
		put(t, root, path, content)
	}
	return root, t.TempDir()
}
func put(t *testing.T, root, path, content string) {
	t.Helper()
	p := filepath.Join(root, path)
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
func builder(count *atomic.Int32) func(string) error {
	return func(path string) error { count.Add(1); return os.WriteFile(path, []byte("binary"), 0o700) }
}
func TestReuseAndInputChanges(t *testing.T) {
	root, cache := fixture(t)
	var count atomic.Int32
	run := func(env string) string {
		t.Helper()
		p, e := prepare(context.Background(), root, cache, []string{env}, builder(&count))
		if e != nil {
			t.Fatal(e)
		}
		return p
	}
	first := run("host-1")
	put(t, root, ".aidd/tasks/second/task.json", `{"id":"other","body":"different","arguments":[]}`)
	put(t, root, "apps/web/src/app.tsx", "changed product")
	if got := run("host-1"); got != first || count.Load() != 1 {
		t.Fatalf("ordinary Task rebuilt: %s %d", got, count.Load())
	}
	for i, path := range []string{"tools/aidd/checker/main.go", "tools/aidd/checker/go.mod", "tools/aidd/checker/go.sum", "docs/ai-driven-development/contracts/protocol.json", "docs/ai-driven-development/contracts/verification-profiles.json", "docs/ai-driven-development/contracts/requirements-sections.json", "docs/rule.md"} {
		put(t, root, path, "updated")
		next := run("host-1")
		if next == first || count.Load() != int32(i+2) {
			t.Fatalf("input change did not build: %s", path)
		}
		if run("host-1") != next || count.Load() != int32(i+2) {
			t.Fatal("new identity not reused")
		}
		first = next
	}
	if run("host-2") == first || count.Load() != 9 {
		t.Fatal("environment reused")
	}
}
func TestCorruptionNeverBuildsOrReturnsBinary(t *testing.T) {
	for _, kind := range []string{"binary", "missing-binary", "manifest", "missing-manifest", "identity", "symlink", "mode"} {
		t.Run(kind, func(t *testing.T) {
			root, cache := fixture(t)
			var count atomic.Int32
			p, err := prepare(context.Background(), root, cache, nil, builder(&count))
			if err != nil {
				t.Fatal(err)
			}
			m := filepath.Join(filepath.Dir(p), "manifest.json")
			switch kind {
			case "binary":
				_ = os.Chmod(p, 0o700)
				put(t, filepath.Dir(p), "aidd-checker", "replaced")
			case "missing-binary":
				_ = os.Remove(p)
			case "manifest":
				_ = os.Chmod(m, 0o600)
				put(t, filepath.Dir(p), "manifest.json", "invalid")
			case "missing-manifest":
				_ = os.Remove(m)
			case "identity":
				b, _ := os.ReadFile(m)
				var v manifest
				_ = json.Unmarshal(b, &v)
				v.Identity.Version++
				b, _ = json.Marshal(v)
				_ = os.Chmod(m, 0o600)
				_ = os.WriteFile(m, b, 0o600)
			case "symlink":
				_ = os.Remove(p)
				_ = os.Symlink("/bin/echo", p)
			case "mode":
				_ = os.Chmod(p, 0o400)
			}
			got, err := prepare(context.Background(), root, cache, nil, builder(&count))
			if err == nil || got != "" || count.Load() != 1 {
				t.Fatalf("corruption accepted: %s %v %d", got, err, count.Load())
			}
		})
	}
}
func TestConcurrentPreparationBuildsOnce(t *testing.T) {
	root, cache := fixture(t)
	var count atomic.Int32
	var wg sync.WaitGroup
	paths := make(chan string, 8)
	errs := make(chan error, 8)
	for range 8 {
		wg.Go(func() {
			p, e := prepare(context.Background(), root, cache, nil, builder(&count))
			paths <- p
			errs <- e
		})
	}
	wg.Wait()
	close(paths)
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal(e)
		}
	}
	first := ""
	for p := range paths {
		if first == "" {
			first = p
		}
		if p != first {
			t.Fatal("different publication")
		}
	}
	if count.Load() != 1 {
		t.Fatalf("builds: %d", count.Load())
	}
}
func TestFailedBuildAndChangedInputsAreNotPublished(t *testing.T) {
	root, cache := fixture(t)
	_, err := prepare(context.Background(), root, cache, nil, func(p string) error {
		put(t, root, "tools/aidd/checker/main.go", "changed during build")
		return os.WriteFile(p, []byte("binary"), 0o700)
	})
	if err == nil || !strings.Contains(err.Error(), "changed during") {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(cache)
	if len(entries) != 0 {
		t.Fatal("published partial entry")
	}
	var count atomic.Int32
	if _, err := prepare(context.Background(), root, cache, nil, builder(&count)); err != nil {
		t.Fatal(err)
	}
}
func TestRejectInputOverrideAndSymlink(t *testing.T) {
	for _, path := range []string{"../outside", "/absolute", "docs/../outside"} {
		root, cache := fixture(t)
		put(t, root, "docs/harness/rule-map.json", `{"rules":[{"file":"`+path+`"}]}`)
		var count atomic.Int32
		if _, err := prepare(context.Background(), root, cache, nil, builder(&count)); err == nil || count.Load() != 0 {
			t.Fatal("accepted invalid contract path")
		}
	}
	root, cache := fixture(t)
	_ = os.Remove(filepath.Join(root, "docs/rule.md"))
	_ = os.Symlink("/etc/hosts", filepath.Join(root, "docs/rule.md"))
	var count atomic.Int32
	if _, err := prepare(context.Background(), root, cache, nil, builder(&count)); err == nil {
		t.Fatal("accepted symlink")
	}
}
func TestBuildEnvironmentIgnoresCallerFlags(t *testing.T) {
	t.Setenv("GOFLAGS", "-overlay=evil.json")
	t.Setenv("GOOS", "other")
	t.Setenv("GOARCH", "other")
	t.Setenv("GOWORK", "/tmp/other")
	t.Setenv("GOEXPERIMENT", "other")
	t.Setenv("CGO_ENABLED", "1")
	for _, e := range buildEnvironment() {
		if strings.Contains(e, "evil") || strings.HasSuffix(e, "=other") || strings.Contains(e, "/tmp/other") || e == "CGO_ENABLED=1" {
			t.Fatalf("uncontrolled input: %s", e)
		}
	}
}

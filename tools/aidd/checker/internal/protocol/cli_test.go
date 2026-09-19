package protocol

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
)

func TestPublicCLIEndToEnd(t *testing.T) {
	f := setup(t, "development")
	// 同じfixtureを新binaryの公開入口から開始する。
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	binary := filepath.Join(t.TempDir(), "aidd-checker")
	build := exec.Command("go", "build", "-o", binary, "./cmd/aidd-checker")
	build.Dir = "../.."
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v %s", err, out)
	}
	invoke := func(args ...string) string {
		t.Helper()
		args = append(args, "--repo-root", f.root)
		cmd := exec.Command(binary, args...)
		cmd.Dir = f.root
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("%v: %v %s", args, err, out)
		}
		return string(out)
	}
	call := func(args ...string) string {
		out := invoke(args...)
		fields := strings.Fields(out)
		return fields[len(fields)-1]
	}
	source := func(name string, value any) string {
		t.Helper()
		path := filepath.Join(t.TempDir(), name)
		b, err := canonical.Pretty(value)
		must(t, err)
		must(t, os.WriteFile(path, b, 0600))
		return path
	}
	f.spec.SchemaVersion = CompactVersion
	f.decision.SchemaVersion = 0
	f.decision.Kind = ""
	f.spec.Intent.BodySHA256 = ""
	f.taskHash = call("task-start", "--source", source("task.json", f.spec))
	f.decision.TaskSHA256 = ""
	f.cp = call("checkpoint", "--task", f.spec.ID, "--latest", "--expect-revision", "0", "--source", source("decision.json", f.decision))
	var page Page
	must(t, json.Unmarshal([]byte(invoke("task-status", "--task", f.spec.ID, "--limit", "200")), &page))
	if page.Revision != 1 || page.Next == nil {
		t.Fatal("missing revision or continuation")
	}
	f.cp = call("decision-update", "--task", f.spec.ID, "--expect-revision", "1", "--source", source("update.json", DecisionUpdate{Reason: "Clarified rationale"}))
	cmd := exec.Command(binary, "verify", "--repo-root", f.root, "--task", f.spec.ID, "--latest", "--expect-revision", "1")
	if out, err := cmd.CombinedOutput(); err == nil || !strings.Contains(string(out), "STALE_CHECKPOINT") {
		t.Fatalf("stale revision accepted: %v %s", err, out)
	}
	f.put("src/a.txt", "verified result\n")
	f.evidenceHash = call("verify", "--task", f.spec.ID, "--latest", "--expect-revision", "2")
	common := []string{"--task", f.spec.ID, "--latest", "--expect-revision", "2"}
	f.git("add", ".")
	call(append([]string{"ship-check"}, common...)...)
	call(append([]string{"finish"}, common...)...)
	base := f.git("rev-parse", "HEAD")
	f.git("commit", "-qm", "CLI delivery")
	call("ci-check", "--base", base)
}

func TestReadOnlyRequestCannotStart(t *testing.T) {
	f := setup(t, "development")
	for _, action := range []string{"inspect", "explain", "investigate", ""} {
		spec := f.spec
		spec.Action = action
		rejected(t, validateSpec(spec), "ENTRYPOINT")
	}
}

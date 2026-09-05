package protocol

import (
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
	call := func(args ...string) string {
		t.Helper()
		args = append(args, "--repo-root", f.root)
		cmd := exec.Command(binary, args...)
		cmd.Dir = f.root
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("%v: %v %s", args, err, out)
		}
		fields := strings.Fields(string(out))
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
	f.taskHash = call("task-start", "--source", source("task.json", f.spec))
	f.decision.TaskSHA256 = f.taskHash
	f.cp = call("checkpoint", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--source", source("decision.json", f.decision))
	f.put("src/a.txt", "verified result\n")
	f.evidenceHash = call("verify", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp)
	common := []string{"--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp, "--evidence-sha256", f.evidenceHash}
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

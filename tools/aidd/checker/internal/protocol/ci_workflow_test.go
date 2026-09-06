package protocol

import (
	"go.yaml.in/yaml/v3"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestCISelectsTrustFromCurrentTargetBase(t *testing.T) {
	data, err := os.ReadFile("../../../../../.github/workflows/aidd_checker_ci.yaml")
	must(t, err)
	var workflow struct {
		Jobs map[string]struct {
			Steps []struct {
				Name string
				Run  string
				Env  map[string]string
			}
		}
	}
	must(t, yaml.Unmarshal(data, &workflow))
	var script string
	for _, step := range workflow.Jobs["verify"].Steps {
		if step.Name == "Verify delivery with the base protocol" {
			script = step.Run
			if step.Env["PR_AUTHOR_LOGIN"] != "${{ github.event.pull_request.user.login }}" {
				t.Fatal("delivery must use the PR author from the GitHub event")
			}
		}
	}
	if script == "" {
		t.Fatal("delivery step not found")
	}
	for _, tc := range []struct {
		name, author, actor string
		hasV5, skipDelivery bool
	}{
		{"bootstrap", "contributor", "contributor", false, false},
		{"current-v5-base", "contributor", "contributor", true, false},
		{"renovate-rerun-by-human", "renovate[bot]", "contributor", true, true},
		{"human-rerun-by-renovate", "contributor", "renovate[bot]", true, false},
		{"similar-author-name", "renovateb", "contributor", true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := setup(t, "development")
			must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
			must(t, os.Remove(filepath.Join(f.root, PolicyPath)))
			f.put("tools/aidd/checker/source-marker", "old merge-base\n")
			f.git("add", ".")
			f.git("commit", "-qm", "old baseline")
			ancestor := f.git("rev-parse", "HEAD")
			f.git("checkout", "-qb", "target-base")
			if tc.hasV5 {
				f.put(PolicyPath, `{"schema_version":1}`)
			}
			f.put("tools/aidd/checker/source-marker", "current target base\n")
			f.git("add", ".")
			f.git("commit", "-qm", "target evolves")
			target := f.git("rev-parse", "HEAD")
			f.git("checkout", "-qb", "candidate", ancestor)
			f.put("guard/rule.md", "candidate\n")
			f.git("add", ".")
			f.git("commit", "-qm", "candidate change")
			head := f.git("rev-parse", "HEAD")
			bin := t.TempDir()
			trace := filepath.Join(bin, "trace")
			// 実workflowの分岐とarchiveを実行し、buildとchecker呼出しだけを置き換える。
			fakeGo := `#!/bin/sh
set -eu
dir= output=
while [ "$#" -gt 0 ]; do
 case "$1" in
 -C) dir="$2"; shift 2;;
 -o) output="$2"; shift 2;;
 *) shift;;
 esac
done
cat "$dir/source-marker" > "$TRACE"
cat > "$output" <<'CHECKER'
#!/bin/sh
[ "$1" = ci-check ] || exit 91
printf '%s\n' "$@" >> "$TRACE"
CHECKER
chmod +x "$output"
`
			must(t, os.WriteFile(filepath.Join(bin, "go"), []byte(fakeGo), 0755))
			candidate := filepath.Join(bin, "candidate-checker")
			must(t, os.WriteFile(candidate, []byte("#!/bin/sh\n[ \"$1\" = bootstrap-check ] || exit 92\nprintf '%s\\n' \"$@\" > \"$TRACE\"\n"), 0755))
			cmd := exec.Command("bash", "-c", strings.ReplaceAll(script, "/tmp/aidd-checker", candidate))
			cmd.Dir = f.root
			cmd.Env = append(os.Environ(), "PATH="+bin+":"+os.Getenv("PATH"), "TRACE="+trace, "PR_AUTHOR_LOGIN="+tc.author, "GITHUB_ACTOR="+tc.actor, "PR_BASE_SHA="+target, "PR_HEAD_SHA="+head, "GITHUB_WORKSPACE="+f.root)
			if output, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("workflow failed: %v\n%s", err, output)
			}
			output, err := os.ReadFile(trace)
			if tc.skipDelivery {
				if !os.IsNotExist(err) {
					t.Fatalf("Renovate PR invoked delivery verification: %s, error: %v", output, err)
				}
				return
			}
			must(t, err)
			actual := string(output)
			if tc.hasV5 {
				if !strings.HasPrefix(actual, "current target base\nci-check\n") || !strings.Contains(actual, "--base\n"+ancestor+"\n") {
					t.Fatalf("wrong trusted source or baseline: %s", actual)
				}
			} else if !strings.HasPrefix(actual, "bootstrap-check\n") || !strings.Contains(actual, "--target-base\n"+target+"\n") {
				t.Fatalf("bootstrap lacks current target base: %s", actual)
			}
		})
	}
}

package protocol

import (
	"encoding/json"
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
		commitKinds         []string
	}{
		{"bootstrap", "contributor", "contributor", false, false, []string{"human"}},
		{"current-v5-base", "contributor", "contributor", true, false, []string{"human"}},
		{"renovate-rerun-by-human", "renovate[bot]", "contributor", true, true, []string{"renovate"}},
		{"human-rerun-by-renovate", "contributor", "renovate[bot]", true, false, []string{"renovate"}},
		{"similar-author-name", "renovateb", "contributor", true, false, []string{"renovate"}},
		{"renovate-multiple-commits", "renovate[bot]", "contributor", true, true, []string{"renovate", "renovate"}},
		{"renovate-human-followup", "renovate[bot]", "contributor", true, false, []string{"renovate", "human"}},
		{"renovate-human-then-bot", "renovate[bot]", "renovate[bot]", true, false, []string{"renovate", "human", "renovate"}},
		{"renovate-human-cherry-pick", "renovate[bot]", "contributor", true, false, []string{"cherry-pick"}},
		{"spoofed-emails-unsigned", "renovate[bot]", "contributor", true, false, []string{"spoofed"}},
		{"personal-signature", "renovate[bot]", "contributor", true, false, []string{"personal-signature"}},
		{"invalid-signature", "renovate[bot]", "contributor", true, false, []string{"invalid-signature"}},
		{"wrong-signer", "renovate[bot]", "contributor", true, false, []string{"wrong-signer"}},
		{"api-failure", "renovate[bot]", "contributor", true, false, []string{"api-failure"}},
		{"missing-commit", "renovate[bot]", "contributor", true, false, []string{"missing-commit"}},
		{"wrong-sha", "renovate[bot]", "contributor", true, false, []string{"wrong-sha"}},
		{"graphql-error", "renovate[bot]", "contributor", true, false, []string{"graphql-error"}},
		{"older-unsigned-commit", "renovate[bot]", "contributor", true, false, []string{"spoofed", "renovate"}},
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
			apiFixtures := t.TempDir()
			for i, kind := range tc.commitKinds {
				f.put("guard/rule.md", strings.Repeat("candidate\n", i+1))
				f.git("add", ".")
				switch kind {
				case "human":
					f.git("commit", "-qm", "human change")
				case "cherry-pick":
					f.git("commit", "--author=renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>", "-qm", "human cherry-pick")
				default:
					f.git("-c", "user.email=noreply@github.com", "-c", "commit.gpgsign=false", "commit", "--author=renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>", "-qm", "claimed Renovate update")
				}
				sha := f.git("rev-parse", "HEAD")
				// Gitの自己申告情報と、GitHubが返す署名検証結果を独立して設定する。
				signature := map[string]any{"isValid": true, "state": "VALID", "wasSignedByGitHub": true, "signer": map[string]string{"login": "web-flow"}}
				commit := map[string]any{"oid": sha, "author": map[string]any{"user": map[string]string{"login": "renovate[bot]"}}, "signature": signature}
				response := map[string]any{"data": map[string]any{"repository": map[string]any{"object": commit}}}
				switch kind {
				case "human":
					commit["author"] = map[string]any{"user": map[string]string{"login": "contributor"}}
				case "cherry-pick", "spoofed":
					commit["signature"] = nil
				case "personal-signature":
					signature["wasSignedByGitHub"] = false
					signature["signer"] = map[string]string{"login": "contributor"}
				case "invalid-signature":
					signature["isValid"] = false
					signature["state"] = "INVALID"
				case "wrong-signer":
					signature["signer"] = map[string]string{"login": "contributor"}
				case "api-failure":
					continue
				case "missing-commit":
					response["data"] = nil
				case "wrong-sha":
					commit["oid"] = strings.Repeat("0", 40)
				case "graphql-error":
					response["errors"] = []any{map[string]string{"message": "incomplete response"}}
				}
				data, err := json.Marshal(response)
				must(t, err)
				must(t, os.WriteFile(filepath.Join(apiFixtures, sha+".json"), data, 0600))
			}
			head := f.git("rev-parse", "HEAD")
			bin := t.TempDir()
			trace := filepath.Join(bin, "trace")
			// 実workflowの分岐・JSON検証・archiveを実行し、API通信・build・checker呼出しだけを置き換える。
			fakeGH := `#!/bin/sh
set -eu
oid=
for arg in "$@"; do
 case "$arg" in oid=*) oid=${arg#oid=};; esac
done
test -n "$oid"
cat "$GH_FIXTURES/$oid.json"
`
			must(t, os.WriteFile(filepath.Join(bin, "gh"), []byte(fakeGH), 0755))
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
			cmd.Env = append(os.Environ(), "PATH="+bin+":"+os.Getenv("PATH"), "TRACE="+trace, "GH_FIXTURES="+apiFixtures, "GITHUB_REPOSITORY=owner/repo", "PR_AUTHOR_LOGIN="+tc.author, "GITHUB_ACTOR="+tc.actor, "PR_BASE_SHA="+target, "PR_HEAD_SHA="+head, "GITHUB_WORKSPACE="+f.root)
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

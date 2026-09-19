package protocol

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func compactFixture(t *testing.T, extra int) *fixture {
	t.Helper()
	f := setup(t, "development")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	for i := 0; i < extra; i++ {
		f.put(fmt.Sprintf("unchanged/%04d.txt", i), "fixed\n")
	}
	if extra > 0 {
		f.git("add", ".")
		f.git("commit", "-qm", "larger repository")
	}
	f.spec.SchemaVersion = CompactVersion
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.SchemaVersion = CompactVersion
	f.decision.TaskSHA256 = f.taskHash
	return f
}

func TestCompactLifecycleAndGitTransfer(t *testing.T) {
	f := compactFixture(t, 0)
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	f.put("src/a.txt", "after\n")
	must(t, f.verify())
	must(t, f.check(false))
	before, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	for _, field := range []string{`"baseline":`, `"rule_map":`, `"catalog":`, `"policy":`} {
		if bytes.Contains(before, []byte(field)) {
			t.Fatalf("redundant field %s", field)
		}
	}
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		e, _, err := read[Evidence](s, evidencePath(f.spec.ID, f.cp))
		if err != nil {
			return err
		}
		if len(e.Files) != 0 || e.GitRepositorySHA256 == "" {
			t.Fatal("full inventory or missing transport identity")
		}
		return nil
	}))
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "compact delivery")
	// Git転送時の0600→0644変化を再現する。
	must(t, filepath.WalkDir(filepath.Join(f.root, TaskRoot), func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			return os.Chmod(path, 0644)
		}
		return nil
	}))
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }))
	after, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	if !bytes.Equal(before, after) {
		t.Fatal("task changed")
	}
}

func TestCompactRejectsStateChanges(t *testing.T) {
	for _, change := range []string{"content", "mode", "non-executable-mode", "added", "deleted", "unowned", "revision"} {
		t.Run(change, func(t *testing.T) {
			f := compactFixture(t, 0)
			f.decision.Target.OwnershipScopes = []model.OwnershipScope{{Path: "src", Kind: "tree"}}
			must(t, f.checkpoint())
			f.put("src/a.txt", "after\n")
			must(t, f.verify())
			must(t, f.check(false))
			switch change {
			case "content":
				f.put("src/a.txt", "changed\n")
			case "mode":
				must(t, os.Chmod(filepath.Join(f.root, "src/a.txt"), 0755))
			case "non-executable-mode":
				must(t, os.Chmod(filepath.Join(f.root, "src/a.txt"), 0600))
			case "added":
				f.put("src/new.txt", "untracked\n")
			case "deleted":
				must(t, os.Remove(filepath.Join(f.root, "src/a.txt")))
			case "unowned":
				f.put("guard/rule.md", "outside scope\n")
			case "revision":
				old, err := os.ReadFile(filepath.Join(f.root, evidencePath(f.spec.ID, f.cp)))
				must(t, err)
				must(t, f.checkpoint())
				f.put(evidencePath(f.spec.ID, f.cp), string(old))
			}
			rejected(t, f.check(false), "")
		})
	}
}

func TestCompactDecisionUpdateAndPaging(t *testing.T) {
	f := compactFixture(t, 0)
	must(t, f.checkpoint())
	must(t, f.verify())
	old := f.cp
	u := DecisionUpdate{Reason: "観測結果の説明を更新", Behaviors: Changes[model.ProductBehavior]{Upsert: []model.ProductBehavior{{ID: "PB-1", Type: "state_transition", Description: "変更後の結果を表示する", RequirementID: "FR-1"}}}}
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.cp, err = UpdateDecision(context.Background(), s, f.spec.ID, 1, u)
		return
	}))
	if old == f.cp {
		t.Fatal("revision unchanged")
	}
	rejected(t, f.check(false), "")
	rejected(t, f.snapshot(func(s *repository.Snapshot) error {
		_, err := UpdateDecision(context.Background(), s, f.spec.ID, 1, u)
		return err
	}), "STALE_CHECKPOINT")
	u = DecisionUpdate{Reason: "invalid deletion", Requirements: Changes[Requirement]{Remove: []string{"FR-1"}}}
	rejected(t, f.snapshot(func(s *repository.Snapshot) error {
		_, err := UpdateDecision(context.Background(), s, f.spec.ID, 2, u)
		return err
	}), "REQUIREMENT")
	u.Requirements.Remove = []string{"FR-999"}
	rejected(t, f.snapshot(func(s *repository.Snapshot) error {
		_, err := UpdateDecision(context.Background(), s, f.spec.ID, 2, u)
		return err
	}), "UPDATE")
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, _, err := Resolve(context.Background(), s, f.spec.ID, 2)
		if err != nil {
			return err
		}
		if len(l.Checkpoint.Decision.Target.VerificationCases) != 1 || l.Checkpoint.Decision.Target.ProductBehaviors[0].Description != "変更後の結果を表示する" {
			t.Fatal("patch lost unrelated fields")
		}
		var reconstructed strings.Builder
		for offset := 0; ; {
			p, err := Inspect(context.Background(), s, f.spec.ID, "decision", offset, 100)
			if err != nil {
				return err
			}
			if len([]rune(p.Content)) > 100 {
				t.Fatal("unbounded page")
			}
			reconstructed.WriteString(p.Content)
			if p.Next == nil {
				break
			}
			offset = *p.Next
		}
		var d Decision
		if err := canonical.Decode([]byte(reconstructed.String()), "decision", &d); err != nil {
			return err
		}
		if hash(d) != hash(l.Checkpoint.Decision) {
			t.Fatal("paging lost data")
		}
		return nil
	}))
}

func TestCompactRuleSnapshotsAndTampering(t *testing.T) {
	f := compactFixture(t, 0)
	includePaths(f, "docs/harness/rule-map.json")
	must(t, f.checkpoint())
	path := filepath.Join(f.root, "docs/harness/rule-map.json")
	b, err := os.ReadFile(path)
	must(t, err)
	f.put("docs/harness/rule-map.json", string(b)+"\n")
	must(t, f.checkpoint())
	must(t, f.checkpoint())
	files, err := filepath.Glob(filepath.Join(f.root, taskPath(f.spec.ID, "snapshots/*.json")))
	must(t, err)
	if len(files) != 1 {
		t.Fatalf("snapshot count %d", len(files))
	}
	must(t, f.verify())
	must(t, f.check(false))
	// 同じ内容は一度保存し、各checkpointから参照する。
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		_, _, err := Resolve(context.Background(), s, f.spec.ID, 3)
		return err
	}))
	before, err := os.ReadFile(files[0])
	must(t, err)
	for _, variant := range []string{"tampered", "missing"} {
		if variant == "tampered" {
			must(t, os.WriteFile(files[0], bytes.Replace(before, []byte("invariant"), []byte("corrupted"), 1), 0600))
		} else {
			must(t, os.Remove(files[0]))
		}
		rejected(t, f.snapshot(func(s *repository.Snapshot) error {
			_, _, err := Resolve(context.Background(), s, f.spec.ID, 3)
			return err
		}), "")
		must(t, os.WriteFile(files[0], before, 0600))
	}
}

func TestCompactMissingGitAndStrictWire(t *testing.T) {
	f := compactFixture(t, 0)
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		task, _, err := read[Task](s, taskPath(f.spec.ID, "task.json"))
		if err != nil {
			return err
		}
		task.BaselineHead = strings.Repeat("f", 40)
		rejected(t, hydrateTask(context.Background(), s, &task), "")
		b, err := canonical.Pretty(task)
		if err != nil {
			return err
		}
		b = bytes.Replace(b, []byte(`"kind": "task"`), []byte(`"kind": "task", "baseline": []`), 1)
		rejected(t, canonical.Decode(b, "task", &task), "SHAPE")
		return nil
	}))
}

func TestLegacySerializationUnchanged(t *testing.T) {
	f := setup(t, "development")
	f.spec.Intent.Body = "<intent> & 日本語"
	f.spec.Intent.BodySHA256 = canonical.HashBytes([]byte(f.spec.Intent.Body))
	task := Task{SchemaVersion: Version, Kind: "task", Spec: f.spec}
	actual, err := canonical.Pretty(task)
	must(t, err)
	expected, err := canonical.Pretty(legacyTask(task))
	must(t, err)
	if !bytes.Equal(actual, expected) {
		t.Fatal("v5 task bytes changed")
	}
	e := Evidence{SchemaVersion: Version, Verification: []byte("<bytes>"), ChangedPaths: []string{"a&b"}}
	actual, err = canonical.Pretty(e)
	must(t, err)
	expected, err = canonical.Pretty(legacyEvidence(e))
	must(t, err)
	if !bytes.Equal(actual, expected) {
		t.Fatal("v5 evidence bytes changed")
	}
}

func TestCompactStorageGrowth(t *testing.T) {
	var sizes []int
	for _, n := range []int{0, 100} {
		f := compactFixture(t, n)
		must(t, f.checkpoint())
		f.put("src/a.txt", "after\n")
		must(t, f.verify())
		total := 0
		for _, path := range []string{taskPath(f.spec.ID, "task.json"), checkpointPath(f.spec.ID, 1), evidencePath(f.spec.ID, f.cp)} {
			b, err := os.ReadFile(filepath.Join(f.root, path))
			must(t, err)
			total += len(b)
		}
		sizes = append(sizes, total)
	}
	if sizes[0] != sizes[1] {
		t.Fatalf("unchanged repository growth changed storage: %v", sizes)
	}
}

func TestCompactBenchmarkScenarios(t *testing.T) {
	for _, kind := range []string{"document", "application", "revision"} {
		t.Run(kind, func(t *testing.T) {
			for _, version := range []int{Version, CompactVersion} {
				started := time.Now()
				f := setup(t, "development")
				if version == CompactVersion {
					must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
					f.spec.SchemaVersion = version
					must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
						f.taskHash, err = Start(context.Background(), s, f.spec)
						return
					}))
					f.decision.SchemaVersion = version
					f.decision.TaskSHA256 = f.taskHash
				}
				path := "src/a.txt"
				if kind == "document" {
					path = "guard/rule.md"
					f.decision.Target.OwnershipScopes[0].Path = path
					f.decision.Target.Representations[0].Path = path
				}
				must(t, f.checkpoint())
				f.put(path, "after\n")
				input, err := canonical.Pretty(f.decision)
				must(t, err)
				if kind == "revision" {
					if version == CompactVersion {
						u := DecisionUpdate{Reason: "Clarify verification rationale"}
						input, err = canonical.Pretty(u)
						must(t, err)
						must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
							f.cp, err = UpdateDecision(context.Background(), s, f.spec.ID, 1, u)
							return
						}))
					} else {
						f.decision.Reason = "Clarify verification rationale"
						must(t, f.checkpoint())
						input, err = canonical.Pretty(f.decision)
						must(t, err)
					}
				}
				if version == CompactVersion && kind != "revision" {
					var fields map[string]json.RawMessage
					must(t, json.Unmarshal(input, &fields))
					delete(fields, "schema_version")
					delete(fields, "kind")
					delete(fields, "task_sha256")
					input, err = canonical.Pretty(fields)
					must(t, err)
				}
				must(t, f.verify())
				must(t, f.check(false))
				total := 0
				must(t, filepath.WalkDir(filepath.Join(f.root, TaskRoot), func(p string, d os.DirEntry, e error) error {
					if e != nil {
						return e
					}
					if !d.IsDir() {
						b, e := os.ReadFile(p)
						if e != nil {
							return e
						}
						total += len(b)
					}
					return nil
				}))
				// 通常CLI成功出力は旧形式でも小さい。比較対象を明示して過大な削減を主張しない。
				calls := 3
				if kind == "revision" {
					calls = 4
				}
				output := ""
				prefix := "AIDD v5 "
				if version == CompactVersion {
					prefix = "AIDD "
				}
				commands := []string{"task-start", "checkpoint", "verify"}
				digests := []string{f.taskHash, f.cp, f.evidenceHash}
				if kind == "revision" {
					command := "checkpoint"
					if version == CompactVersion {
						command = "decision-update"
					}
					commands = append(commands, command)
					digests = append(digests, f.cp)
				}
				for i, command := range commands {
					output += prefix + command + ": verified " + digests[i] + "\n"
				}
				t.Logf("scenario=%s schema=%d storage_bytes=%d decision_input_bytes=%d output_bytes=%d normal_calls=%d elapsed_ms=%d", kind, version, total, len(input), len(output), calls, time.Since(started).Milliseconds())
				if dir := os.Getenv("AIDD_COMPACT_METRICS"); dir != "" {
					record := struct {
						Scenario string `json:"scenario"`
						Schema   int    `json:"schema"`
						Storage  int    `json:"storage_bytes"`
						Input    string `json:"decision_input"`
						Output   string `json:"success_output"`
						Calls    int    `json:"calls"`
					}{kind, version, total, string(input), output, calls}
					b, err := json.MarshalIndent(record, "", "  ")
					must(t, err)
					must(t, os.WriteFile(filepath.Join(dir, fmt.Sprintf("%s-v%d.json", kind, version)), b, 0600))
				}
			}
		})
	}
}

func TestCompactSharedDelivery(t *testing.T) { testSharedDelivery(t, CompactVersion) }

func TestCompactMainIntegration(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		t.Run(kind, func(t *testing.T) {
			f, base := integratedFixtureVersion(t, kind, CompactVersion)
			rejected(t, f.check(false), "")
			must(t, f.checkpoint())
			must(t, f.verify())
			must(t, f.check(false))
			f.git("add", ".")
			must(t, f.check(true))
			f.git("commit", "-qm", "compact integration")
			must(t, f.snapshot(func(s *repository.Snapshot) error {
				return CheckDelivery(context.Background(), s, base, f.spec.ID, base)
			}))
			rejected(t, f.snapshot(func(s *repository.Snapshot) error {
				return CheckDelivery(context.Background(), s, base, f.spec.ID, strings.Repeat("a", 40))
			}), "INTEGRATION_BASE")
		})
	}
}

func TestCompactBaselinePermissions(t *testing.T) {
	f := setup(t, "development")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	must(t, os.Chmod(filepath.Join(f.root, "guard/rule.md"), 0600))
	f.spec.SchemaVersion = CompactVersion
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.SchemaVersion = CompactVersion
	f.decision.TaskSHA256 = f.taskHash
	must(t, f.checkpoint())
	must(t, f.verify())
	must(t, f.check(false))
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, _, err := Resolve(context.Background(), s, f.spec.ID, 1)
		if err != nil {
			return err
		}
		if len(l.Task.BaselineModes) != 1 || fileMap(l.Task.Baseline)["guard/rule.md"].Mode != "0600" {
			t.Fatal("baseline permissions lost")
		}
		return nil
	}))
	must(t, os.Chmod(filepath.Join(f.root, "guard/rule.md"), 0644))
	rejected(t, f.verify(), "OWNERSHIP")
}

func TestCompactRejectsNullAndDuplicateUpdates(t *testing.T) {
	for _, source := range []string{`{"reason":"remove authorization","product_authorization":null}`, `{"reason":"change","reason":"another"}`, `{"reason":"change","unknown":true}`} {
		var update DecisionUpdate
		rejected(t, canonical.Decode([]byte(source), "update", &update), "")
	}
}

package protocol

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

// 旧writerが保存したfieldをcheckpoint作成前のfixtureへ復元する。
func setupLegacyTask(t *testing.T, kind, delivery string) *fixture {
	t.Helper()
	f := setup(t, kind)
	if delivery == "" {
		return f
	}
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		task, _, err := read[Task](s, taskPath(f.spec.ID, "task.json"))
		if err != nil {
			return err
		}
		task.Spec.LegacyDelivery = delivery
		content, err := canonical.Pretty(task)
		if err != nil {
			return err
		}
		f.put(taskPath(f.spec.ID, "task.json"), string(content))
		f.taskHash = canonical.HashBytes(content)
		return nil
	}))
	f.decision.TaskSHA256 = f.taskHash
	return f
}

func TestTaskDeliveryDoesNotGateCompletionOrShip(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		for _, delivery := range []string{"", "local", "pr"} {
			t.Run(kind+"/"+delivery, func(t *testing.T) {
				f := setupLegacyTask(t, kind, delivery)
				taskPath := filepath.Join(f.root, taskPath(f.spec.ID, "task.json"))
				before, err := os.ReadFile(taskPath)
				must(t, err)
				if delivery == "" && bytes.Contains(before, []byte(`"delivery"`)) {
					t.Fatal("new Task retains delivery")
				}
				base := f.git("rev-parse", "HEAD")
				must(t, f.checkpoint())
				if kind == "learn" {
					f.put("guard/rule.md", "Updated guardrail\n")
				} else {
					f.put("src/a.txt", "Updated result\n")
				}
				must(t, f.verify())
				must(t, f.snapshot(func(s *repository.Snapshot) error {
					l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
					if err != nil {
						return err
					}
					return Finish(context.Background(), s, l, f.evidenceHash)
				}))
				rejected(t, f.check(true), "STAGED_DRIFT")
				f.git("add", ".")
				must(t, f.check(true))
				f.git("commit", "-qm", "verified result")
				must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }))
				after, err := os.ReadFile(taskPath)
				must(t, err)
				if !bytes.Equal(before, after) {
					t.Fatal("Task bytes changed during continuation")
				}
			})
		}
	}
}

func TestNewTaskDropsLegacyDeliveryInput(t *testing.T) {
	for _, delivery := range []string{"local", "pr"} {
		t.Run(delivery, func(t *testing.T) {
			f := setup(t, "learn")
			// 旧source互換性を確認するため、fixtureをcommitしてcleanな基準点を作る。
			f.git("add", ".")
			f.git("commit", "-qm", "prior task fixture")
			f.spec.ID = "next-task"
			f.spec.LegacyDelivery = delivery
			must(t, f.snapshot(func(s *repository.Snapshot) error {
				_, err := Start(context.Background(), s, f.spec)
				return err
			}))
			body, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
			must(t, err)
			if bytes.Contains(body, []byte(`"delivery"`)) {
				t.Fatal("legacy input persisted in new Task")
			}
		})
	}
}

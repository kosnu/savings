package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"os"
	"path/filepath"
	"testing"
)

func TestStorybookCoverageSeesRemovedAndNewTags(t *testing.T) {
	for _, variant := range []string{"edit", "remove-tag", "delete", "add-tag", "untagged", "covered"} {
		t.Run(variant, func(t *testing.T) {
			f := setup(t, "development")
			must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
			path := "apps/web/src/demo.stories.tsx"
			before := "export const tags = ['browser-test']\n"
			if variant == "add-tag" || variant == "untagged" {
				before = "export const tags = []\n"
			}
			f.put(path, before)
			f.git("add", ".")
			f.git("commit", "-qm", "stories baseline")
			must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
				f.taskHash, err = Start(context.Background(), s, f.spec)
				return
			}))
			f.decision.TaskSHA256 = f.taskHash
			must(t, f.checkpoint())
			switch variant {
			case "edit", "covered":
				f.put(path, before+"export const label = 'updated'\n")
			case "remove-tag", "untagged":
				f.put(path, "export const tags = []\nexport const label = 'updated'\n")
			case "delete":
				must(t, os.Remove(filepath.Join(f.root, path)))
			case "add-tag":
				f.put(path, "export const tags = ['browser-test']\n")
			}
			err := f.snapshot(func(s *repository.Snapshot) error {
				l, err := loadTask(s, f.spec.ID, f.taskHash)
				if err != nil {
					return err
				}
				if err = loadCheckpoints(s, l); err != nil {
					return err
				}
				files, err := inventory(context.Background(), s)
				if err != nil {
					return err
				}
				if variant == "covered" {
					l.Checkpoint.Decision.Target.VerificationCases = append(l.Checkpoint.Decision.Target.VerificationCases, model.VerificationCase{Type: "automated", VerificationProfileID: "web-storybook-suite", Selector: &model.Selector{Kind: "suite"}})
				}
				return l.requireStorybook(context.Background(), s, files)
			})
			if variant == "untagged" || variant == "covered" {
				must(t, err)
			} else {
				rejected(t, err, "VERIFICATION_COVERAGE")
			}
		})
	}
}

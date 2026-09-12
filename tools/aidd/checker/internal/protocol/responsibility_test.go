package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repositorypolicy"
	"os"
	"path/filepath"
	"testing"
)

func restartWithPolicy(t *testing.T, f *fixture, p repositorypolicy.Policy) {
	t.Helper()
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	data, err := canonical.Pretty(p)
	must(t, err)
	f.put(repositorypolicy.Path, string(data))
	f.git("add", ".")
	f.git("commit", "-qm", "repository policy fixture")
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.TaskSHA256 = f.taskHash
}
func TestRepositoryPolicyControlsOwnershipWithoutCoreChange(t *testing.T) {
	for _, forbid := range []bool{false, true} {
		t.Run(map[bool]string{false: "allowed", true: "forbidden"}[forbid], func(t *testing.T) {
			f := setup(t, "development")
			p := repositorypolicy.Legacy()
			p.ForbiddenTreeScopes = []string{}
			if forbid {
				p.ForbiddenTreeScopes = []string{"src"}
			}
			restartWithPolicy(t, f, p)
			f.decision.Target.OwnershipScopes = []model.OwnershipScope{{Path: "src", Kind: "tree"}}
			err := f.checkpoint()
			if forbid {
				rejected(t, err, "SCOPE_BROAD")
			} else {
				must(t, err)
				f.put("src/a.txt", "after\n")
				must(t, f.verify())
			}
		})
	}
}
func TestConditionalPolicyControlsPathTagAndSuite(t *testing.T) {
	f := setup(t, "development")
	p := repositorypolicy.Legacy()
	p.ConditionalVerification = []repositorypolicy.ConditionalVerification{{Paths: []string{"src/*.txt"}, Detector: "storybook_tag_text", Value: "custom-tag", Profiles: []string{"web-storybook-suite"}}}
	restartWithPolicy(t, f, p)
	must(t, f.checkpoint())
	f.put("src/a.txt", "custom-tag\n")
	rejected(t, f.verify(), "VERIFICATION_COVERAGE")
	vc := f.decision.Target.VerificationCases[0]
	vc.ID = "VC-2"
	vc.VerificationProfileID = "web-storybook-suite"
	f.decision.Target.VerificationCases = append(f.decision.Target.VerificationCases, vc)
	f.decision.Target.Representations[0].VerificationCaseIDs = []string{"VC-1", "VC-2"}
	must(t, f.checkpoint())
	must(t, f.verify())
}
func TestRequiredSuiteComesFromPolicyRatherThanItsName(t *testing.T) {
	f := setup(t, "development")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	var p Policy
	data, err := os.ReadFile(filepath.Join(f.root, PolicyPath))
	must(t, err)
	must(t, canonical.Decode(data, "policy", &p))
	p.RequiredVerification = []VerificationRoute{{Paths: []string{"src/**"}, Profiles: []string{"web-storybook-suite"}}}
	data, err = canonical.Pretty(p)
	must(t, err)
	f.put(PolicyPath, string(data))
	rp := repositorypolicy.Legacy()
	restartWithPolicy(t, f, rp)
	rejected(t, f.checkpoint(), "VERIFICATION_COVERAGE")
	f.decision.Target.VerificationCases[0].VerificationProfileID = "web-storybook-suite"
	must(t, f.checkpoint())
	f.put("src/a.txt", "after\n")
	must(t, f.verify())
}
func TestRepositoryPolicyIsPinnedAndCannotBeRemoved(t *testing.T) {
	f := setup(t, "learn")
	must(t, f.checkpoint())
	rp := repositorypolicy.Legacy()
	rp.ForbiddenTreeScopes = []string{"changed"}
	data, err := canonical.Pretty(rp)
	must(t, err)
	f.put(repositorypolicy.Path, string(data))
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, err := loadTask(s, f.spec.ID, f.taskHash)
		if err != nil {
			return err
		}
		if len(l.RepositoryPolicy.ForbiddenTreeScopes) == 1 {
			t.Fatal("candidate policy replaced pinned policy")
		}
		return nil
	}))
	must(t, os.Remove(filepath.Join(f.root, repositorypolicy.Path)))
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckConfiguration(context.Background(), s) }), "POLICY")
}
func TestBaselinePolicyMismatchRejectsAndLegacyDoesNotReadCandidate(t *testing.T) {
	f := setup(t, "development")
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		task, _, err := read[Task](s, taskPath(f.spec.ID, "task.json"))
		if err != nil {
			return err
		}
		legacy := task
		legacy.Baseline = nil
		rp, err := taskRepositoryPolicy(s, legacy)
		if err != nil {
			return err
		}
		if len(rp.ForbiddenTreeScopes) == 0 {
			t.Fatal("legacy guards missing")
		}
		for i := range task.Baseline {
			if task.Baseline[i].Path == repositorypolicy.Path {
				task.Baseline[i].SHA256 = "wrong"
			}
		}
		_, err = taskRepositoryPolicy(s, task)
		rejected(t, err, "POLICY")
		return nil
	}))
}
func TestCurrentProfileMustSatisfyRepositoryInvocationPolicy(t *testing.T) {
	f := setup(t, "learn")
	f.put(catalog.DefaultPath, `{"schema_version":1,"profiles":[{"id":"git-diff-check","contract":"suite","runner":"command_suite","selector_kind":"suite","argv":["git","diff","--check"]},{"id":"web-storybook-suite","contract":"suite","runner":"command_suite","selector_kind":"suite","argv":["git","diff","--check"]},{"id":"zz-example","contract":"test_case","runner":"vitest_json","selector_kind":"test_case","selector_root":"src","working_directory":"src","argv":["npx","vitest"]}]}`)
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckConfiguration(context.Background(), s) }), "policy")
}

func TestLegacyTaskStillVerifiesWithoutRepositoryPolicyFile(t *testing.T) {
	f := setup(t, "development")
	// 旧binaryが作成した記録をfixtureとして再現する。新規Startの欠落拒否とは分離する。
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		task, _, err := read[Task](s, taskPath(f.spec.ID, "task.json"))
		if err != nil {
			return err
		}
		must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
		must(t, os.Remove(filepath.Join(f.root, repositorypolicy.Path)))
		f.git("add", ".")
		f.git("commit", "-qm", "legacy fixture without new policy")
		task.BaselineHead = f.git("rev-parse", "HEAD")
		files := []File{}
		for _, file := range task.Baseline {
			if file.Path != repositorypolicy.Path {
				files = append(files, file)
			}
		}
		task.Baseline = files
		data, err := canonical.Pretty(task)
		if err != nil {
			return err
		}
		path := filepath.Join(f.root, taskPath(f.spec.ID, "task.json"))
		must(t, os.MkdirAll(filepath.Dir(path), 0755))
		must(t, os.WriteFile(path, data, 0600))
		f.taskHash = canonical.HashBytes(data)
		f.decision.TaskSHA256 = f.taskHash
		return nil
	}))
	must(t, f.checkpoint())
	f.put("src/a.txt", "after\n")
	must(t, f.verify())
	must(t, f.check(false))
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckConfiguration(context.Background(), s) }), "POLICY")
}

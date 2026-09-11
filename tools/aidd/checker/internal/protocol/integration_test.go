package protocol

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"go.yaml.in/yaml/v3"
)

// main由来のproduct/guardrail/別Task記録を実際のGit mergeで取り込む。
func integratedFixture(t *testing.T, kind string) (*fixture, string) {
	t.Helper()
	f := setup(t, kind)
	baseline := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	f.put(f.decision.Target.Representations[0].Path, "task result\n")
	must(t, f.verify())
	f.git("add", ".")
	f.git("commit", "-qm", "verified task result")
	taskHead := f.git("rev-parse", "HEAD")
	f.git("checkout", "-qb", "integrated-main", baseline)
	f.put("src/main.txt", "main product\n")
	f.put("guard/main.md", "main guardrail\n")
	f.put(".aidd/tasks/other/task.json", "main task record\n")
	f.git("add", ".")
	f.git("commit", "-qm", "main evolves independently")
	base := f.git("rev-parse", "HEAD")
	f.git("checkout", "--detach", taskHead)
	f.git("merge", "--no-edit", "integrated-main")
	// Git転送は0600を保持しない。ローカルartifactの要件は維持する。
	must(t, filepath.WalkDir(filepath.Join(f.root, taskPath(f.spec.ID, "")), func(path string, entry os.DirEntry, err error) error {
		if err == nil && !entry.IsDir() {
			err = os.Chmod(path, 0600)
		}
		return err
	}))
	f.decision.Integration = &Integration{BaseHead: base, Head: f.git("rev-parse", "HEAD")}
	return f, base
}

func TestIntegrationPreservesTaskAndReverifiesFinalTree(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		t.Run(kind, func(t *testing.T) {
			f, base := integratedFixture(t, kind)
			original, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
			must(t, err)
			// 統合前の証拠は成功扱いにしない。
			rejected(t, f.check(false), "")
			oldEvidence := f.evidenceHash
			must(t, f.checkpoint())
			rejected(t, f.check(false), "")
			must(t, f.verify())
			if f.evidenceHash == oldEvidence {
				t.Fatal("integration reused old evidence")
			}
			must(t, f.check(false))
			current, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
			must(t, err)
			if string(current) != string(original) {
				t.Fatal("integration changed task identity")
			}
			f.git("add", ".")
			must(t, f.check(true))
			f.git("commit", "-qm", "verified integration")
			must(t, f.snapshot(func(s *repository.Snapshot) error {
				return CheckDelivery(context.Background(), s, base, f.spec.ID, base)
			}))
			for _, target := range []string{"", strings.Repeat("a", 40)} {
				rejected(t, f.snapshot(func(s *repository.Snapshot) error {
					return CheckDelivery(context.Background(), s, base, f.spec.ID, target)
				}), "INTEGRATION_BASE")
			}
		})
	}
}

func TestIntegrationRejectsChangesToImportedFiles(t *testing.T) {
	for _, change := range []string{"add", "modify", "delete", "mode", "other-task"} {
		t.Run(change, func(t *testing.T) {
			f, _ := integratedFixture(t, "learn")
			must(t, f.checkpoint())
			must(t, f.verify())
			switch change {
			case "add":
				f.put("src/unverified.txt", "new unverified product\n")
			case "modify":
				f.put("src/main.txt", "modified product\n")
			case "delete":
				must(t, os.Remove(filepath.Join(f.root, "src/main.txt")))
			case "mode":
				must(t, os.Chmod(filepath.Join(f.root, "src/main.txt"), 0755))
			case "other-task":
				f.put(".aidd/tasks/other/task.json", "changed record\n")
			}
			rejected(t, f.check(false), "LEARN_SCOPE")
			// 再verifyを呼ぶだけで無許可の差分を追認しない。
			rejected(t, f.verify(), "LEARN_SCOPE")
		})
	}
}

func TestIntegrationHistoryCannotBeRewoundOrRemoved(t *testing.T) {
	for _, variant := range []string{"missing", "malformed", "unmerged", "rewind", "remove"} {
		t.Run(variant, func(t *testing.T) {
			f, _ := integratedFixture(t, "development")
			if variant == "rewind" || variant == "remove" {
				must(t, f.checkpoint())
			}
			switch variant {
			case "missing":
				f.decision.Integration.Head = strings.Repeat("f", 40)
			case "malformed":
				f.decision.Integration.BaseHead = "HEAD"
			case "unmerged":
				f.decision.Integration.Head = f.decision.Integration.BaseHead
				f.decision.Integration.BaseHead = f.git("rev-parse", "HEAD")
			case "rewind":
				f.decision.Integration.BaseHead = f.git("rev-parse", "integrated-main^")
			case "remove":
				f.decision.Integration = nil
			}
			rejected(t, f.checkpoint(), "INTEGRATION")
		})
	}
}

func TestIntegrationRequiresOwnershipForMainPathsChangedByTask(t *testing.T) {
	f, _ := integratedFixture(t, "development")
	f.put("src/main.txt", "task-specific edit of imported file\n")
	must(t, f.checkpoint())
	rejected(t, f.verify(), "OWNERSHIP")
	f.decision.Target.OwnershipScopes = append(f.decision.Target.OwnershipScopes, model.OwnershipScope{Path: "src/main.txt", Kind: "file"})
	f.decision.Target.Representations = append(f.decision.Target.Representations, model.Representation{ID: "REP-2", Kind: "implementation", Path: "src/main.txt", Locator: model.Locator{Kind: "file"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationCaseIDs: []string{"VC-1"}})
	must(t, f.checkpoint())
	must(t, f.verify())
	f.put("src/main.txt", "changed again without verification\n")
	rejected(t, f.check(false), "STALE_EVIDENCE")
}

func TestIntegrationConflictResolutionIsVerifiedAndThenInvalidated(t *testing.T) {
	f := setup(t, "development")
	baseline := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	f.put("src/a.txt", "task change\n")
	must(t, f.verify())
	f.git("add", ".")
	f.git("commit", "-qm", "task changes shared file")
	taskHead := f.git("rev-parse", "HEAD")
	f.git("checkout", "-qb", "conflicting-main", baseline)
	f.put("src/a.txt", "main change\n")
	f.git("add", ".")
	f.git("commit", "-qm", "main changes shared file")
	base := f.git("rev-parse", "HEAD")
	f.git("checkout", "--detach", taskHead)
	merge := exec.Command("git", "merge", "--no-edit", base)
	merge.Dir = f.root
	if err := merge.Run(); err == nil {
		t.Fatal("expected real merge conflict")
	}
	f.put("src/a.txt", "main and task combined\n")
	f.git("add", ".")
	f.git("commit", "-qm", "resolve shared file")
	must(t, filepath.WalkDir(filepath.Join(f.root, taskPath(f.spec.ID, "")), func(path string, e os.DirEntry, err error) error {
		if err == nil && !e.IsDir() {
			return os.Chmod(path, 0600)
		}
		return err
	}))
	f.decision.Integration = &Integration{BaseHead: base, Head: f.git("rev-parse", "HEAD")}
	must(t, f.checkpoint())
	must(t, f.verify())
	f.git("add", ".")
	f.git("commit", "-qm", "verify conflict resolution")
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		return CheckDelivery(context.Background(), s, base, f.spec.ID, base)
	}))
	f.put("src/a.txt", "changed resolution after verification\n")
	f.git("add", ".")
	f.git("commit", "-qm", "unverified resolution")
	rejected(t, f.snapshot(func(s *repository.Snapshot) error {
		return CheckDelivery(context.Background(), s, base, f.spec.ID, base)
	}), "STALE_EVIDENCE")
}

func TestIntegrationCanAdvanceBaseButMustReverify(t *testing.T) {
	f, base := integratedFixture(t, "learn")
	must(t, f.checkpoint())
	must(t, f.verify())
	f.git("add", ".")
	f.git("commit", "-qm", "first integration")
	previous := f.git("rev-parse", "HEAD")
	f.git("checkout", "integrated-main")
	f.put("src/main.txt", "main advanced\n")
	f.git("add", ".")
	f.git("commit", "-qm", "advance main")
	next := f.git("rev-parse", "HEAD")
	f.git("checkout", "--detach", previous)
	rejected(t, f.snapshot(func(s *repository.Snapshot) error {
		return CheckDelivery(context.Background(), s, base, f.spec.ID, next)
	}), "INTEGRATION_BASE")
	f.git("merge", "--no-edit", next)
	must(t, filepath.WalkDir(filepath.Join(f.root, taskPath(f.spec.ID, "")), func(path string, e os.DirEntry, err error) error {
		if err == nil && !e.IsDir() {
			return os.Chmod(path, 0600)
		}
		return err
	}))
	f.decision.Integration = &Integration{BaseHead: next, Head: f.git("rev-parse", "HEAD")}
	must(t, f.checkpoint())
	rejected(t, f.check(false), "")
	must(t, f.verify())
	f.git("add", ".")
	f.git("commit", "-qm", "second integration")
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		return CheckDelivery(context.Background(), s, next, f.spec.ID, next)
	}))
}

func TestIntegrationMixedFieldsCompareAgainstImportedContent(t *testing.T) {
	for _, kind := range []string{"learn", "development"} {
		t.Run(kind, func(t *testing.T) {
			f := setupMixed(t, kind)
			// Task出力をcommitせずbase変更だけをcommitし、fast-forward統合を再現する。
			path := filepath.Join(f.root, "package.json")
			original, err := os.ReadFile(path)
			must(t, err)
			before, after := `"react":"1"`, `"react":"2"`
			if kind == "development" {
				before, after = `"vitest":"1"`, `"vitest":"2"`
			}
			imported := strings.ReplaceAll(string(original), before, after)
			f.put("package.json", imported)
			f.git("add", "package.json")
			f.git("commit", "-qm", "trusted main updates protected field")
			base := f.git("rev-parse", "HEAD")
			f.decision.Integration = &Integration{BaseHead: base, Head: base}
			must(t, f.checkpoint())
			must(t, f.verify())
			if kind == "learn" {
				f.put("package.json", strings.ReplaceAll(imported, `"vitest":"1"`, `"vitest":"3"`))
			} else {
				f.put("package.json", strings.ReplaceAll(imported, `"react":"1"`, `"react":"3"`))
			}
			must(t, f.verify())
			f.put("package.json", string(original))
			rejected(t, f.verify(), "")
		})
	}
}

func TestIntegrationLockfileKeepsImportedToolClosure(t *testing.T) {
	f := setupMixed(t, "development")
	imported := strings.ReplaceAll(sampleLock, "helper-old", "imported-tool-resolution")
	f.put(lockPath, imported)
	f.git("add", lockPath)
	f.git("commit", "-qm", "main adds lockfile")
	base := f.git("rev-parse", "HEAD")
	f.decision.Integration = &Integration{BaseHead: base, Head: base}
	f.decision.Target.OwnershipScopes = append(f.decision.Target.OwnershipScopes, model.OwnershipScope{Path: lockPath, Kind: "file"})
	rep := f.decision.Target.Representations[0]
	rep.ID, rep.Path = "REP-2", lockPath
	f.decision.Target.Representations = append(f.decision.Target.Representations, rep)
	must(t, f.checkpoint())
	f.put(lockPath, strings.ReplaceAll(imported, "react-old", "task-product-resolution"))
	must(t, f.verify())
	f.put(lockPath, strings.ReplaceAll(imported, "imported-tool-resolution", "unapproved-tool-resolution"))
	rejected(t, f.verify(), "LOCKFILE_BOUNDARY")
}

func TestIntegrationRemovalOfImportedBrowserTagRequiresSuite(t *testing.T) {
	f := setup(t, "development")
	path := "apps/web/src/imported.stories.tsx"
	f.put(path, "export const tags = ['browser-test']\n")
	f.git("add", path)
	f.git("commit", "-qm", "main adds browser story")
	base := f.git("rev-parse", "HEAD")
	f.decision.Integration = &Integration{BaseHead: base, Head: base}
	f.decision.Target.OwnershipScopes = append([]model.OwnershipScope{{Path: path, Kind: "file"}}, f.decision.Target.OwnershipScopes...)
	rep := f.decision.Target.Representations[0]
	rep.ID, rep.Path = "REP-2", path
	f.decision.Target.Representations = append(f.decision.Target.Representations, rep)
	must(t, f.checkpoint())
	f.put(path, "export const tags = []\n")
	rejected(t, f.verify(), "VERIFICATION_COVERAGE")
}

func TestCandidateMigrationWorkflowChecksLatestTreeWithRealChecker(t *testing.T) {
	f, base := integratedFixture(t, "learn")
	must(t, f.checkpoint())
	must(t, f.verify())
	f.git("add", ".")
	f.git("commit", "-qm", "verified integration")
	binary := filepath.Join(t.TempDir(), "aidd-checker")
	build := exec.Command("go", "build", "-o", binary, "./cmd/aidd-checker")
	build.Dir = "../.."
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build checker: %v %s", err, output)
	}
	data, err := os.ReadFile("../../../../../.github/workflows/aidd_checker_ci.yaml")
	must(t, err)
	var workflow struct {
		Jobs map[string]struct{ Steps []struct{ Run string } }
	}
	must(t, yaml.Unmarshal(data, &workflow))
	steps := workflow.Jobs["candidate"].Steps
	script := strings.ReplaceAll(steps[len(steps)-1].Run, "/tmp/aidd-checker", binary)
	run := func(pass bool) {
		t.Helper()
		cmd := exec.Command("bash", "-c", script)
		cmd.Dir = f.root
		cmd.Env = append(os.Environ(), "PR_BODY=```aidd-contract-migration\n{\"task_id\":\"test-task\"}\n```", "PR_BASE_SHA="+base, "PR_HEAD_SHA="+f.git("rev-parse", "HEAD"), "GITHUB_WORKSPACE="+f.root)
		output, err := cmd.CombinedOutput()
		if (err == nil) != pass {
			t.Fatalf("workflow pass=%v: %v %s", pass, err, output)
		}
	}
	run(true)
	// merge後のcommitを過去treeへ巻き戻して検査してはならない。
	f.put("guard/rule.md", "unverified post-merge change\n")
	f.git("add", ".")
	f.git("commit", "-qm", "unverified post-merge change")
	run(false)
}

func TestOldTaskMigratesCheckerWithoutReplacingItsHistory(t *testing.T) {
	f, base := integratedFixture(t, "learn")
	oldTask, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	binary := filepath.Join(t.TempDir(), "aidd-checker")
	build := exec.Command("go", "build", "-o", binary, "./cmd/aidd-checker")
	build.Dir = "../.."
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v %s", err, output)
	}
	newBytes, err := os.ReadFile(binary)
	must(t, err)
	oldChecker, err := checkerIdentity()
	must(t, err)
	oldCP, oldEvidence := f.cp, f.evidenceHash
	call := func(pass bool, fragment string, args ...string) string {
		t.Helper()
		cmd := exec.Command(binary, append(args, "--repo-root", f.root)...)
		out, err := cmd.CombinedOutput()
		if (err == nil) != pass || fragment != "" && !strings.Contains(string(out), fragment) {
			t.Fatalf("%v pass=%v: %v %s", args, pass, err, out)
		}
		words := strings.Fields(string(out))
		return words[len(words)-1]
	}
	source := filepath.Join(t.TempDir(), "decision.json")
	checkpoint := func(pass bool, fragment string) string {
		t.Helper()
		data, err := canonical.Pretty(f.decision)
		must(t, err)
		must(t, os.WriteFile(source, data, 0600))
		return call(pass, fragment, "checkpoint", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp, "--source", source)
	}
	checkpoint(false, "CHECKER_IDENTITY")
	f.decision.CheckerMigration = &CheckerMigration{FromCheckerSHA256: oldChecker, ToCheckerSHA256: canonical.HashBytes(newBytes), FromCheckpointSHA256: oldCP, FromEvidenceSHA256: oldEvidence, Authorization: "User explicitly authorized this checker migration and guardrail correction", AuthorizedScopes: []model.OwnershipScope{{Path: "guard/main.md", Kind: "file"}}}
	for _, variant := range []string{"authorization", "checkpoint", "evidence", "checker", "product"} {
		good := *f.decision.CheckerMigration
		switch variant {
		case "authorization":
			f.decision.CheckerMigration.Authorization = ""
		case "checkpoint":
			f.decision.CheckerMigration.FromCheckpointSHA256 = strings.Repeat("a", 64)
		case "evidence":
			f.decision.CheckerMigration.FromEvidenceSHA256 = strings.Repeat("a", 64)
		case "checker":
			f.decision.CheckerMigration.FromCheckerSHA256 = strings.Repeat("a", 64)
		case "product":
			f.decision.CheckerMigration.AuthorizedScopes = []model.OwnershipScope{{Path: "src/a.txt", Kind: "file"}}
		}
		checkpoint(false, "MIGRATION")
		f.decision.CheckerMigration = &good
	}
	f.decision.Target.OwnershipScopes = append([]model.OwnershipScope{{Path: "guard/main.md", Kind: "file"}}, f.decision.Target.OwnershipScopes...)
	rep := f.decision.Target.Representations[0]
	rep.ID, rep.Path = "REP-2", "guard/main.md"
	f.decision.Target.Representations = append(f.decision.Target.Representations, rep)
	f.cp = checkpoint(true, "")
	f.put("guard/main.md", "explicitly authorized follow-up correction\n")
	f.evidenceHash = call(true, "", "verify", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp)
	rejected(t, f.check(false), "CHECKER_IDENTITY")
	currentTask, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	if string(currentTask) != string(oldTask) {
		t.Fatal("migration rewrote the task")
	}
	oldBytes, err := os.ReadFile(filepath.Join(f.root, evidencePath(f.spec.ID, oldCP)))
	must(t, err)
	if canonical.HashBytes(oldBytes) != oldEvidence {
		t.Fatal("migration rewrote old evidence")
	}
	f.git("add", ".")
	call(true, "", "ship-check", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp, "--evidence-sha256", f.evidenceHash)
	f.git("commit", "-qm", "verified checker migration")
	args := []string{"ci-check", "--base", base, "--target-base", base, "--task", f.spec.ID}
	call(false, "MIGRATION_REQUIRED", args...)
	call(true, "", append(args, "--contract-migration")...)
	f.decision.CheckerMigration = nil
	checkpoint(false, "MIGRATION_HISTORY")
	f.put("guard/rule.md", "unverified post-migration change\n")
	f.git("add", ".")
	f.git("commit", "-qm", "unverified change")
	call(false, "STALE_EVIDENCE", append(args, "--contract-migration")...)
}

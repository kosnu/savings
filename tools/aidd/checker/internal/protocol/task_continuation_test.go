package protocol

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

func includePaths(f *fixture, paths ...string) {
	f.t.Helper()
	sort.Strings(paths)
	for _, p := range paths {
		if owned(p, f.decision.Target.OwnershipScopes) {
			continue
		}
		f.decision.Target.OwnershipScopes = append(f.decision.Target.OwnershipScopes, model.OwnershipScope{Path: p, Kind: "file"})
		r := f.decision.Target.Representations[0]
		r.ID = "REP-" + strconv.Itoa(1+len(f.decision.Target.Representations))
		r.Path = p
		f.decision.Target.Representations = append(f.decision.Target.Representations, r)
	}
	sort.Slice(f.decision.Target.OwnershipScopes, func(i, j int) bool {
		return f.decision.Target.OwnershipScopes[i].Path < f.decision.Target.OwnershipScopes[j].Path
	})
}

func TestOldDevelopmentCheckerMigratesAndContinues(t *testing.T) {
	binary := filepath.Join(t.TempDir(), "aidd-checker")
	build := exec.Command("go", "build", "-o", binary, "./cmd/aidd-checker")
	build.Dir = "../.."
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v %s", err, out)
	}
	newBytes, err := os.ReadFile(binary)
	must(t, err)
	oldChecker, err := checkerIdentity()
	must(t, err)
	for _, withEvidence := range []bool{false, true} {
		t.Run(map[bool]string{false: "blocked-before-verification", true: "previously-verified"}[withEvidence], func(t *testing.T) {
			f := setup(t, "development")
			base := f.git("rev-parse", "HEAD")
			must(t, f.checkpoint())
			if withEvidence {
				must(t, f.verify())
			}
			originalTask, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
			must(t, err)
			f.put("guard/rule.md", "rule imported while using the old checker\n")
			f.git("add", ".")
			f.git("commit", "-qm", "import")
			includePaths(f, "guard/rule.md")
			f.decision.CheckerMigration = &CheckerMigration{FromCheckerSHA256: oldChecker, ToCheckerSHA256: canonical.HashBytes(newBytes), FromCheckpointSHA256: f.cp, FromEvidenceSHA256: f.evidenceHash, Authorization: "User authorized updated checker and rule adoption", AuthorizedScopes: []model.OwnershipScope{}}
			call := func(pass bool, fragment string, args ...string) string {
				t.Helper()
				cmd := exec.Command(binary, append(args, "--repo-root", f.root)...)
				out, err := cmd.CombinedOutput()
				if (err == nil) != pass || fragment != "" && !strings.Contains(string(out), fragment) {
					t.Fatalf("%v: %v %s", args, err, out)
				}
				words := strings.Fields(string(out))
				return words[len(words)-1]
			}
			source := filepath.Join(t.TempDir(), "decision.json")
			checkpoint := func(pass bool, fragment string) string {
				b, err := canonical.Pretty(f.decision)
				must(t, err)
				must(t, os.WriteFile(source, b, 0600))
				return call(pass, fragment, "checkpoint", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp, "--source", source)
			}
			f.decision.CheckerMigration.AuthorizedScopes = []model.OwnershipScope{{Path: "guard/rule.md", Kind: "file"}}
			checkpoint(false, "MIGRATION_SCOPE")
			f.decision.CheckerMigration.AuthorizedScopes = []model.OwnershipScope{}
			goodEvidence := f.decision.CheckerMigration.FromEvidenceSHA256
			if withEvidence {
				f.decision.CheckerMigration.FromEvidenceSHA256 = ""
			} else {
				f.decision.CheckerMigration.FromEvidenceSHA256 = strings.Repeat("a", 64)
			}
			checkpoint(false, "MIGRATION_EVIDENCE")
			f.decision.CheckerMigration.FromEvidenceSHA256 = goodEvidence
			f.cp = checkpoint(true, "")
			f.evidenceHash = call(true, "", "verify", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp)
			rejected(t, f.check(false), "CHECKER_IDENTITY")
			currentTask, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
			must(t, err)
			if string(currentTask) != string(originalTask) {
				t.Fatal("checker migration replaced original Task")
			}
			f.git("add", ".")
			call(true, "", "ship-check", "--task", f.spec.ID, "--task-sha256", f.taskHash, "--checkpoint-sha256", f.cp, "--evidence-sha256", f.evidenceHash)
			f.git("commit", "-qm", "continued old development")
			call(true, "", "ci-check", "--base", base, "--task", f.spec.ID)
		})
	}
}

func TestDevelopmentEditsProductAndRulesWithoutSeparateTaskOrCommit(t *testing.T) {
	f := setup(t, "development")
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	original, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	includePaths(f, "guard/rule.md")
	must(t, f.checkpoint())
	f.put("src/a.txt", "implemented\n")
	f.put("guard/rule.md", "updated rule\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "product and rules together")
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }))
	current, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	if string(current) != string(original) {
		t.Fatal("Task was replaced")
	}
}

func TestCheckpointUsesUpdatedRuleMapWithoutImportCommit(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	data, err := os.ReadFile(filepath.Join(f.root, rules.DefaultPath))
	must(t, err)
	var graph map[string]any
	must(t, canonical.Decode(data, "graph", &graph))
	nodes := graph["rules"].([]any)
	nodes[0].(map[string]any)["depends_on"] = []any{"new-rule"}
	graph["rules"] = append(nodes, map[string]any{"id": "new-rule", "file": "guard/new.md", "applies_to": map[string]any{}, "depends_on": []any{}, "overrides": []any{}, "priority": 0})
	data, err = canonical.Pretty(graph)
	must(t, err)
	f.put(rules.DefaultPath, string(data))
	f.put("guard/new.md", "new rule\n")
	includePaths(f, rules.DefaultPath, "guard/new.md")
	rejected(t, f.verify(), "RULE_COVERAGE")
	must(t, f.checkpoint())
	must(t, f.verify())
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
		if err == nil && !strings.Contains(strings.Join(l.Checkpoint.Rules, ","), "new-rule") {
			t.Fatal("new rule omitted")
		}
		return err
	}))
}

func TestSameBranchTasksShareDeliveryAndKeepTheirRecords(t *testing.T) {
	testSharedDelivery(t, Version)
}

func testSharedDelivery(t *testing.T, version int) {
	f := setupVersion(t, "development", version)
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	f.put("src/a.txt", "product\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "verified product")
	g := &fixture{t: t, root: f.root, spec: f.spec}
	g.spec.ID = "learn-rules"
	g.spec.Kind = "learn"
	g.spec.Intent.Kind = "feedback"
	g.spec.Intent.Reference = "user:rules"
	g.spec.Authorization = "User authorized maintenance"
	g.spec.AuthorizedScopes = []model.OwnershipScope{{Path: "guard/rule.md", Kind: "file"}}
	must(t, g.snapshot(func(s *repository.Snapshot) (err error) {
		g.taskHash, err = Start(context.Background(), s, g.spec)
		return
	}))
	data, err := canonical.Pretty(f.decision)
	must(t, err)
	must(t, canonical.Decode(data, "copy", &g.decision))
	g.decision.TaskSHA256 = g.taskHash
	g.decision.Target.OwnershipScopes = []model.OwnershipScope{{Path: "guard/rule.md", Kind: "file"}}
	g.decision.Target.Representations[0].Path = "guard/rule.md"
	must(t, g.checkpoint())
	g.put("guard/rule.md", "updated rule\n")
	must(t, g.verify())
	// 両Taskの証拠を最終ソースへ結合する。相手の生成記録では失効しない。
	must(t, f.verify())
	must(t, g.check(false))
	must(t, f.check(false))
	f.git("add", ".")
	must(t, f.check(true))
	must(t, g.check(true))
	f.git("commit", "-qm", "both tasks verified")
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }))
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }))
	// --taskで他Taskの未検証変更を隠せない。
	f.put("guard/rule.md", "unverified\n")
	f.git("add", ".")
	f.git("commit", "-qm", "unverified")
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }), "STALE_EVIDENCE")
}

func TestTaskKindDoesNotOverrideExplicitScope(t *testing.T) {
	f := setup(t, "learn")
	must(t, f.checkpoint())
	includePaths(f, "src/a.txt")
	f.decision.ScopeRevision = &ScopeRevision{AddedScopes: []model.OwnershipScope{{Path: "src/a.txt", Kind: "file"}}, Reason: "User also authorized the related implementation", BoundaryReview: "The explicit request includes the source change", Reviewer: "test reviewer"}
	f.decision.ProductAuthorization = productAuthorization("src/a.txt")
	must(t, f.checkpoint())
	f.put("src/a.txt", "authorized implementation\n")
	must(t, f.verify())
}

func TestDeliveryRejectsUnverifiedChangesBeforeTaskStart(t *testing.T) {
	f := setup(t, "development")
	base := f.git("rev-parse", "HEAD")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	f.put("src/a.txt", "unverified earlier work\n")
	f.git("add", ".")
	f.git("commit", "-qm", "earlier work")
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.TaskSHA256 = f.taskHash
	must(t, f.checkpoint())
	f.put("src/a.txt", "later work\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "later verified work")
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }), "DELIVERY_COVERAGE")
}

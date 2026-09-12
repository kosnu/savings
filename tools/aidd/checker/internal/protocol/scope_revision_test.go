package protocol

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func addScopeDecision(f *fixture, path string) {
	f.decision.ScopeRevision = &ScopeRevision{AddedScopes: []model.OwnershipScope{{Path: path, Kind: "file"}}, Reason: "レビューで必要な検証が判明した", BoundaryReview: "元の許可文と制約を確認し、同じ目的内の検証追加でありユーザーのファイル制限はない", Reviewer: "担当agent"}
	f.decision.Target.OwnershipScopes = append(f.decision.Target.OwnershipScopes, model.OwnershipScope{Path: path, Kind: "file"})
	f.decision.Target.Representations = append(f.decision.Target.Representations, model.Representation{ID: "REP-2", Kind: "implementation", Path: path, Locator: model.Locator{Kind: "file"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationCaseIDs: []string{"VC-1"}})
}

func TestScopeRevisionContinuesLegacyTaskAndInvalidatesEvidence(t *testing.T) {
	f := setup(t, "learn")
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	must(t, f.verify())
	oldCP, oldEvidence := f.cp, f.evidenceHash
	taskBefore, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	cpBefore, err := os.ReadFile(filepath.Join(f.root, checkpointPath(f.spec.ID, 1)))
	must(t, err)
	addScopeDecision(f, "guard/test.md")
	next := f.decision.ScopeRevision
	f.decision.ScopeRevision = nil
	rejected(t, f.checkpoint(), "LEARN_SCOPE")
	f.cp = oldCP
	f.decision.ScopeRevision = next
	must(t, f.checkpoint())
	rejected(t, f.check(false), "")
	f.put("guard/test.md", "Regression verification\n")
	must(t, f.verify())
	must(t, f.check(false))
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		_, err := Load(context.Background(), s, f.spec.ID, f.taskHash, oldCP)
		rejected(t, err, "STALE_CHECKPOINT")
		_, _, err = read[Evidence](s, evidencePath(f.spec.ID, oldCP))
		return err
	}))
	if oldEvidence == f.evidenceHash {
		t.Fatal("old evidence reused")
	}
	taskAfter, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	cpAfter, err := os.ReadFile(filepath.Join(f.root, checkpointPath(f.spec.ID, 1)))
	must(t, err)
	if string(taskBefore) != string(taskAfter) || string(cpBefore) != string(cpAfter) {
		t.Fatal("original records changed")
	}
	// 後続checkpointはイベントを再掲せず、履歴から追加済みscopeを再構成する。
	f.decision.ScopeRevision = nil
	must(t, f.checkpoint())
	must(t, f.verify())
	must(t, f.check(false))
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "scope revision")
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }))
}

func TestScopeRevisionRejectsMissingReviewAndForbiddenScopes(t *testing.T) {
	for _, variant := range []string{"reason", "review", "reviewer", "first", "product", "output", "repeat", "unrecorded"} {
		t.Run(variant, func(t *testing.T) {
			f := setup(t, "learn")
			if variant != "first" {
				must(t, f.checkpoint())
			}
			addScopeDecision(f, "guard/test.md")
			want := "SCOPE_REVISION"
			switch variant {
			case "reason":
				f.decision.ScopeRevision.Reason = ""
			case "review":
				f.decision.ScopeRevision.BoundaryReview = ""
			case "reviewer":
				f.decision.ScopeRevision.Reviewer = ""
			case "product":
				f.decision.ScopeRevision.AddedScopes[0].Path = "src/test.txt"
				want = "LEARN_SCOPE"
			case "output":
				f.decision.ScopeRevision.AddedScopes[0].Path = ".aidd/tasks/x"
			case "repeat":
				f.decision.ScopeRevision.AddedScopes[0].Path = "guard/rule.md"
			case "unrecorded":
				f.decision.ScopeRevision = nil
				want = "LEARN_SCOPE"
			}
			rejected(t, f.checkpoint(), want)
		})
	}
}

func TestScopeRevisionPreservesUserLimits(t *testing.T) {
	for _, source := range []string{"task", "legacy-review"} {
		t.Run(source, func(t *testing.T) {
			f := setup(t, "learn")
			limits := []model.OwnershipScope{{Path: "guard/rule.md", Kind: "file"}, {Path: "guard/test.md", Kind: "file"}}
			if source == "task" {
				must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
				f.spec.UserScopeLimits = limits
				must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
					f.taskHash, err = Start(context.Background(), s, f.spec)
					return
				}))
				f.decision.TaskSHA256 = f.taskHash
			}
			must(t, f.checkpoint())
			addScopeDecision(f, "guard/test.md")
			if source == "legacy-review" {
				f.decision.ScopeRevision.UserScopeLimits = limits
			}
			must(t, f.checkpoint())
			parent := f.cp
			f.decision.ScopeRevision = &ScopeRevision{AddedScopes: []model.OwnershipScope{{Path: "guard/third.md", Kind: "file"}}, Reason: "追加", BoundaryReview: "制限を広げる自己申告", Reviewer: "agent", UserScopeLimits: []model.OwnershipScope{{Path: "guard", Kind: "tree"}}}
			rejected(t, f.checkpoint(), "USER_SCOPE_LIMIT")
			f.cp = parent
			f.decision.ScopeRevision = nil
			f.put("guard/third.md", "not allowed\n")
			rejected(t, f.verify(), "USER_SCOPE_LIMIT")
		})
	}
}

func TestScopeRevisionRequiresNewPathRulesAndSuites(t *testing.T) {
	f := setup(t, "learn")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	data, err := os.ReadFile(filepath.Join(f.root, PolicyPath))
	must(t, err)
	var p Policy
	must(t, json.Unmarshal(data, &p))
	p.RequiredVerification = append(p.RequiredVerification, VerificationRoute{Paths: []string{"guard/test.md"}, Profiles: []string{"web-storybook-suite"}})
	data, err = json.Marshal(p)
	must(t, err)
	f.put(PolicyPath, string(data))
	f.git("add", ".")
	f.git("commit", "-qm", "required suite")
	data, err = os.ReadFile(filepath.Join(f.root, "docs/harness/rule-map.json"))
	must(t, err)
	var ruleMap map[string]any
	must(t, json.Unmarshal(data, &ruleMap))
	ruleMap["rules"] = append(ruleMap["rules"].([]any), map[string]any{"id": "extra", "file": "guard/rule.md", "applies_to": map[string]any{"paths": []string{"guard/test.md"}}, "depends_on": []string{"dependency"}, "overrides": []string{}, "priority": 1})
	data, err = json.Marshal(ruleMap)
	must(t, err)
	f.put("docs/harness/rule-map.json", string(data))
	f.git("add", ".")
	f.git("commit", "-qm", "path-specific rule")
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.TaskSHA256 = f.taskHash
	must(t, f.checkpoint())
	parent := f.cp
	addScopeDecision(f, "guard/test.md")
	rejected(t, f.checkpoint(), "VERIFICATION_COVERAGE")
	f.cp = parent
	f.decision.Target.VerificationCases = append(f.decision.Target.VerificationCases, model.VerificationCase{ID: "VC-2", Type: "automated", RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationProfileID: "web-storybook-suite", Selector: &model.Selector{Kind: "suite"}})
	f.decision.Target.Representations[1].VerificationCaseIDs = append(f.decision.Target.Representations[1].VerificationCaseIDs, "VC-2")
	must(t, f.checkpoint())
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
		if err != nil {
			return err
		}
		if !sameStrings(l.Checkpoint.Rules, []string{"dependency", "extra", "invariant"}) {
			t.Fatalf("missing rule closure: %v", l.Checkpoint.Rules)
		}
		return nil
	}))
}

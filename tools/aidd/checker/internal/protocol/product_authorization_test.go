package protocol

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func productAuthorization(paths ...string) *ProductAuthorization {
	body := "User requests the related product implementation"
	a := &ProductAuthorization{Intent: Intent{Kind: "issue", Reference: "https://github.com/example/repository/issues/2", Body: body, BodySHA256: canonical.HashBytes([]byte(body))}, Authorization: body}
	sort.Strings(paths)
	for _, path := range paths {
		a.Scopes = append(a.Scopes, model.OwnershipScope{Path: path, Kind: "file"})
	}
	return a
}

func TestProductScopeAloneDoesNotAuthorizeImplementation(t *testing.T) {
	for _, source := range []string{"initial", "revision"} {
		t.Run(source, func(t *testing.T) {
			f := setup(t, "learn")
			if source == "initial" {
				must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
				f.spec.AuthorizedScopes = append(f.spec.AuthorizedScopes, model.OwnershipScope{Path: "src/a.txt", Kind: "file"})
				must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
					f.taskHash, err = Start(context.Background(), s, f.spec)
					return
				}))
				f.decision.TaskSHA256 = f.taskHash
			} else {
				must(t, f.checkpoint())
				addScopeDecision(f, "src/a.txt")
			}
			includePaths(f, "src/a.txt")
			must(t, f.checkpoint())
			f.put("src/a.txt", "unrequested implementation\n")
			rejected(t, f.verify(), "PRODUCT_AUTHORITY")
		})
	}
}

func TestProductAuthorizationContinuesSameTaskThroughDelivery(t *testing.T) {
	f := setup(t, "learn")
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	original, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	addScopeDecision(f, "src/a.txt")
	f.decision.ProductAuthorization = productAuthorization("src/a.txt")
	must(t, f.checkpoint())
	f.put("src/a.txt", "authorized implementation\n")
	f.put("guard/rule.md", "related guardrail fix\n")
	must(t, f.verify())
	// 同じ許可を保持して次の判断へ進め、再承認もTask再作成も要求しない。
	f.decision.ScopeRevision = nil
	must(t, f.checkpoint())
	f.put("src/a.txt", "completed implementation\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "same task implementation and rules")
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }))
	after, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	if string(original) != string(after) {
		t.Fatal("original Task changed")
	}
}

func TestProductAuthorizationRejectsMissingOrInvalidEvidence(t *testing.T) {
	for _, variant := range []string{"issue", "body", "hash", "permission", "scope", "scope-kind", "path", "limits"} {
		t.Run(variant, func(t *testing.T) {
			f := setup(t, "learn")
			a := productAuthorization("src/a.txt")
			f.decision.ProductAuthorization = a
			switch variant {
			case "issue":
				a.Intent.Reference = "review:one"
			case "body":
				a.Intent.Body = ""
			case "hash":
				a.Intent.BodySHA256 = strings.Repeat("a", 64)
			case "permission":
				a.Authorization = " "
			case "scope":
				a.Scopes = nil
			case "scope-kind":
				a.Scopes[0].Kind = "glob"
			case "path":
				a.Scopes[0].Path = "../src/a.txt"
			case "limits":
				l := &Loaded{Task: Task{Spec: Spec{UserScopeLimits: []model.OwnershipScope{{Path: "guard/rule.md", Kind: "file"}}}}}
				rejected(t, l.validateProductAuthorization(f.decision), "USER_SCOPE_LIMIT")
				return
			}
			rejected(t, f.checkpoint(), "")
		})
	}
}

func TestProductAuthorizationDoesNotCoverOtherPaths(t *testing.T) {
	f := setup(t, "learn")
	must(t, f.checkpoint())
	addScopeDecision(f, "src/a.txt")
	f.decision.ProductAuthorization = productAuthorization("src/other.txt")
	must(t, f.checkpoint())
	f.put("src/a.txt", "outside implementation permission\n")
	rejected(t, f.verify(), "PRODUCT_AUTHORITY")
}

func TestMixedProductChangeNeedsImplementationAuthority(t *testing.T) {
	f := setupMixed(t, "learn")
	must(t, f.checkpoint())
	b, err := os.ReadFile(filepath.Join(f.root, "package.json"))
	must(t, err)
	f.put("package.json", strings.ReplaceAll(string(b), `"react":"1"`, `"react":"2"`))
	rejected(t, f.verify(), "PRODUCT_AUTHORITY")
}

func TestLockProductChangeNeedsImplementationAuthority(t *testing.T) {
	f := setupMixed(t, "learn")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	f.put(lockPath, sampleLock)
	f.git("add", ".")
	f.git("commit", "-qm", "lock baseline")
	f.spec.AuthorizedScopes = append(f.spec.AuthorizedScopes, model.OwnershipScope{Path: lockPath, Kind: "file"})
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.TaskSHA256 = f.taskHash
	includePaths(f, lockPath)
	must(t, f.checkpoint())
	f.put(lockPath, strings.ReplaceAll(sampleLock, "react-old", "react-new"))
	rejected(t, f.verify(), "PRODUCT_AUTHORITY")
}

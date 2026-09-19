package protocol

import (
	"os"
	"reflect"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repositorypolicy"
)

func TestSharedGateChangesRequireBehaviorSuite(t *testing.T) {
	// 実repositoryのrouting/profileを読むことで宣言の削除も検出する。
	policy, err := os.ReadFile("../../../../../" + PolicyPath)
	must(t, err)
	profiles, err := os.ReadFile("../../../../../" + catalog.DefaultPath)
	must(t, err)
	for _, path := range []string{"vite.config.ts", ".vite-hooks/pre-commit", ".vite-hooks/nested/helper.sh", "tools/aidd/tests/test_shared_gate.py"} {
		t.Run(path, func(t *testing.T) {
			f := setup(t, "learn")
			f.put(PolicyPath, string(policy))
			f.put(catalog.DefaultPath, string(profiles))
			f.put(path, "before\n")
			f.spec.AuthorizedScopes = []model.OwnershipScope{{Path: path, Kind: "file"}}
			f.decision.Target.OwnershipScopes = f.spec.AuthorizedScopes
			f.decision.Target.Representations[0].Path = path
			restartWithPolicy(t, f, repositorypolicy.Legacy())

			// テスト自身にはchecker suiteも必要。共有suite以外を満たしても拒否する。
			if path == "tools/aidd/tests/test_shared_gate.py" {
				vc := f.decision.Target.VerificationCases[0]
				vc.ID, vc.VerificationProfileID = "VC-2", "aidd-checker-tests"
				f.decision.Target.VerificationCases = append(f.decision.Target.VerificationCases, vc)
				f.decision.Target.Representations[0].VerificationCaseIDs = append(f.decision.Target.Representations[0].VerificationCaseIDs, vc.ID)
			}
			rejected(t, f.checkpoint(), "VERIFICATION_COVERAGE")
			vc := f.decision.Target.VerificationCases[0]
			vc.ID, vc.VerificationProfileID = "VC-3", "shared-gate-tests"
			f.decision.Target.VerificationCases = append(f.decision.Target.VerificationCases, vc)
			f.decision.Target.Representations[0].VerificationCaseIDs = append(f.decision.Target.Representations[0].VerificationCaseIDs, vc.ID)
			must(t, f.checkpoint())
		})
	}
}

func TestSharedGateProfileRunsActualRegressionSuite(t *testing.T) {
	data, err := os.ReadFile("../../../../../" + catalog.DefaultPath)
	must(t, err)
	profiles, err := catalog.Parse(data, catalog.DefaultPath)
	must(t, err)
	profile, ok := profiles.Profiles["shared-gate-tests"]
	if !ok {
		t.Fatal("shared-gate-tests profile missing")
	}
	want := []string{"python3", "-B", "-m", "unittest", "-v", "tools.aidd.tests.test_shared_gate"}
	if profile.Contract != "suite" || profile.Runner != "command_suite" || profile.SelectorKind != "suite" || profile.WorkingDirectory != "" || !reflect.DeepEqual(profile.Argv, want) {
		t.Fatalf("shared gate suite invocation = %+v", profile)
	}
}

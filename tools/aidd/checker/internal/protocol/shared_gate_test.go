package protocol

import (
	"fmt"
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
	for _, path := range []string{
		"vite.config.ts", ".vite-hooks/pre-commit", ".vite-hooks/nested/helper.sh",
		"tools/aidd/tests/test_shared_gate.py", PolicyPath, catalog.DefaultPath,
		"package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml",
	} {
		t.Run(path, func(t *testing.T) {
			f := setup(t, "learn")
			f.put(PolicyPath, string(policy))
			f.put(catalog.DefaultPath, string(profiles))
			// contract自身を対象にしても実際の宣言をfixtureで上書きしない。
			switch path {
			case PolicyPath, catalog.DefaultPath:
			case "package.json":
				f.put(path, "{}\n")
			case "pnpm-workspace.yaml":
				f.put(path, "packages: []\n")
			case "pnpm-lock.yaml":
				f.put(path, "lockfileVersion: '9.0'\nimporters: {}\n")
			default:
				f.put(path, "before\n")
			}
			f.spec.AuthorizedScopes = []model.OwnershipScope{{Path: path, Kind: "file"}}
			f.decision.Target.OwnershipScopes = f.spec.AuthorizedScopes
			f.decision.Target.Representations[0].Path = path
			restartWithPolicy(t, f, repositorypolicy.Legacy())

			// 他の必須suiteを満たしたうえで、共有ゲート検証の省略だけを検査する。
			required := []string{"git-diff-check", "shared-gate-tests"}
			omissions := []string{"shared-gate-tests"}
			if path == "tools/aidd/tests/test_shared_gate.py" || path == PolicyPath || path == catalog.DefaultPath {
				required = append(required, "aidd-checker-tests")
			}
			if path == PolicyPath || path == catalog.DefaultPath {
				omissions = append(omissions, "aidd-checker-tests")
			}
			if path == "package.json" || path == "pnpm-lock.yaml" {
				required = append(required, "web-format-check", "web-lint", "web-typecheck", "web-unit-integration-suite")
			}
			baseCase := f.decision.Target.VerificationCases[0]
			for _, omitted := range append(omissions, "") {
				f.decision.Target.VerificationCases = nil
				f.decision.Target.Representations[0].VerificationCaseIDs = nil
				for _, id := range required {
					if id == omitted {
						continue
					}
					vc := baseCase
					vc.ID = fmt.Sprintf("VC-%d", len(f.decision.Target.VerificationCases)+1)
					vc.VerificationProfileID = id
					f.decision.Target.VerificationCases = append(f.decision.Target.VerificationCases, vc)
					f.decision.Target.Representations[0].VerificationCaseIDs = append(f.decision.Target.Representations[0].VerificationCaseIDs, vc.ID)
				}
				if omitted == "" {
					must(t, f.checkpoint())
				} else {
					rejected(t, f.checkpoint(), "必須suite profileがありません: "+omitted)
				}
			}
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

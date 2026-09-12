package testrunner

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func ParseIdentities(snapshot *repository.Snapshot, profile model.VerificationProfile, verificationCase model.VerificationCase, stdout, stderr []byte, resultFile string, requireRegularSelectorFile func(*repository.Snapshot, string) error) ([]model.RuntimeIdentity, error) {
	expected := model.RuntimeIdentity{Kind: verificationCase.Selector.Kind}
	if profile.Contract == "suite" {
		return []model.RuntimeIdentity{{Kind: "suite", ID: profile.ID}}, nil
	}
	expected.Path = verificationCase.Selector.Path
	expected.Name = verificationCase.Selector.Name
	var identities []model.RuntimeIdentity
	switch profile.Runner {
	case "vitest_json":
		content, err := os.ReadFile(resultFile)
		if err != nil {
			return nil, diagnostic.New("AIDD_VITEST_RESULT", verificationCase.ID, "build_verification", "Vitest JSON result cannot be read", nil, err.Error())
		}
		var report struct {
			TestResults []struct {
				Name             string `json:"name"`
				AssertionResults []struct {
					FullName string `json:"fullName"`
					Status   string `json:"status"`
				} `json:"assertionResults"`
			} `json:"testResults"`
		}
		if err := json.Unmarshal(content, &report); err != nil {
			return nil, diagnostic.New("AIDD_VITEST_RESULT", verificationCase.ID, "build_verification", "Vitest JSON result is invalid", nil, err.Error())
		}
		for _, file := range report.TestResults {
			if !filepath.IsAbs(file.Name) {
				return nil, diagnostic.New("AIDD_VITEST_PATH", verificationCase.ID, "build_verification", "Vitest must report an absolute test path", snapshot.Root, file.Name)
			}
			relative, err := filepath.Rel(snapshot.Root, filepath.Clean(file.Name))
			if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
				return nil, diagnostic.New("AIDD_VITEST_PATH", verificationCase.ID, "build_verification", "Vitest reported a test path outside the repository", snapshot.Root, file.Name)
			}
			repositoryPath := filepath.ToSlash(relative)
			if _, err := pathcontract.ValidateRelativePath(repositoryPath); err != nil {
				return nil, diagnostic.New("AIDD_VITEST_PATH", verificationCase.ID, "build_verification", "Vitest reported a non-canonical repository path", nil, file.Name)
			}
			if err := requireRegularSelectorFile(snapshot, repositoryPath); err != nil {
				return nil, err
			}
			for _, assertion := range file.AssertionResults {
				identity := model.RuntimeIdentity{Kind: "test_case", Path: repositoryPath, Name: assertion.FullName}
				if identity == expected {
					if assertion.Status != "passed" {
						return nil, diagnostic.New("AIDD_VITEST_STATUS", verificationCase.ID, "build_verification", "the selected Vitest assertion must report passed", "passed", map[string]any{"identity": identity, "status": assertion.Status})
					}
					identities = append(identities, identity)
					continue
				}
				if assertion.Status != "skipped" {
					return nil, diagnostic.New("AIDD_RUNTIME_IDENTITY", verificationCase.ID, "build_verification", "a non-selected Vitest assertion was executed or reported an unknown status", "skipped", map[string]any{"identity": identity, "status": assertion.Status})
				}
			}
		}
	case "python_unittest":
		if len(bytes.TrimSpace(stdout)) != 0 {
			return nil, diagnostic.New("AIDD_UNITTEST_RESULT", verificationCase.ID, "build_verification", "Python unittest emitted unexpected stdout", "empty stdout", string(stdout))
		}
		target, err := PythonTarget(*verificationCase.Selector)
		if err != nil {
			return nil, err
		}
		if err := RequirePythonResult(verificationCase.ID, target, stderr); err != nil {
			return nil, err
		}
		identities = append(identities, expected)
	default:
		return nil, diagnostic.New("AIDD_RUNNER", verificationCase.ID, "build_verification", "test-case profile runner is unsupported", nil, profile.Runner)
	}
	sort.Slice(identities, func(i, j int) bool {
		if identities[i].Path != identities[j].Path {
			return identities[i].Path < identities[j].Path
		}
		return identities[i].Name < identities[j].Name
	})
	if len(identities) != 1 || identities[0] != expected {
		return nil, diagnostic.New("AIDD_RUNTIME_IDENTITY", verificationCase.ID, "build_verification", "structured runtime test identity does not exactly match the selector", []model.RuntimeIdentity{expected}, identities)
	}
	return identities, nil
}

// ValidateArgvは結果採取に必要な技術契約を守る。package managerの選択はpolicyの責務。
func ValidateArgv(profile model.VerificationProfile, location string) error {
	if profile.Runner == "python_unittest" && (len(profile.Argv) < 4 || !slices.Equal(profile.Argv[len(profile.Argv)-3:], []string{"-m", "unittest", "-v"})) {
		return diagnostic.New("AIDD_PROFILE_ARGV", location, "verification_profile_catalog", "Python unittest requires its verbose adapter invocation", nil, profile.Argv)
	}
	if profile.Runner == "vitest_json" {
		if len(profile.Argv) >= 2 && profile.Argv[0] == "pnpm" && profile.Argv[1] == "run" &&
			(len(profile.Argv) < 3 || profile.Argv[2] == "" || strings.HasPrefix(profile.Argv[2], "-")) {
			return diagnostic.New("AIDD_PROFILE_ARGV", location, "verification_profile_catalog", "pnpm run requires a script before adapter-owned arguments", "pnpm run <script>", profile.Argv)
		}
		for _, arg := range profile.Argv {
			for _, flag := range []string{"--reporter", "--outputFile", "--testNamePattern", "-t"} {
				if arg == flag || strings.HasPrefix(arg, flag+"=") {
					return diagnostic.New("AIDD_PROFILE_ARGV", location, "verification_profile_catalog", "result and selector arguments are adapter-owned", nil, arg)
				}
			}
		}
	}
	return nil
}

func VitestArguments(base []string, resultFile, selectorPath, testName string) []string {
	return append(base, "--reporter=json", "--outputFile="+resultFile, selectorPath, "--testNamePattern=^"+regexp.QuoteMeta(testName)+"$")
}

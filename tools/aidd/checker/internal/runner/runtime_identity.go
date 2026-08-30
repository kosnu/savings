package runner

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func parseRuntimeIdentities(snapshot *repository.Snapshot, profile model.VerificationProfile, verificationCase model.VerificationCase, stdout, stderr []byte, resultFile string) ([]model.RuntimeIdentity, error) {
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
		target, err := pythonUnittestTarget(*verificationCase.Selector)
		if err != nil {
			return nil, err
		}
		if err := requirePythonUnittestResult(verificationCase.ID, target, stderr); err != nil {
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

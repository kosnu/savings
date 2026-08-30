package runner

import (
	"regexp"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

var (
	pythonIdentifier      = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
	pythonUnittestOutcome = regexp.MustCompile(`^([A-Za-z_][A-Za-z0-9_]*) \(([^)]+)\) \.\.\. (ok|FAIL|ERROR|skipped .*)$`)
	pythonUnittestSummary = regexp.MustCompile(`^Ran ([0-9]+) tests? in [0-9]+(?:\.[0-9]+)?s$`)
	pythonSeparator       = regexp.MustCompile(`^-{10,}$`)
)

func pythonUnittestTarget(selector model.Selector) (string, error) {
	if !strings.HasSuffix(selector.Path, ".py") {
		return "", diagnostic.New("AIDD_UNITTEST_SELECTOR", selector.Path, "build_verification", "Python unittest selector path must end in .py", "repository-relative Python test file", selector.Path)
	}
	moduleParts := strings.Split(strings.TrimSuffix(selector.Path, ".py"), "/")
	for _, part := range moduleParts {
		if !pythonIdentifier.MatchString(part) {
			return "", diagnostic.New("AIDD_UNITTEST_SELECTOR", selector.Path, "build_verification", "Python unittest selector path must map to an importable module", "Python identifier path segments", selector.Path)
		}
	}
	nameParts := strings.Split(selector.Name, ".")
	if len(nameParts) != 2 || !pythonIdentifier.MatchString(nameParts[0]) || !pythonIdentifier.MatchString(nameParts[1]) {
		return "", diagnostic.New("AIDD_UNITTEST_SELECTOR", selector.Name, "build_verification", "Python unittest selector name must identify one class method", "TestClass.test_method", selector.Name)
	}
	return strings.Join(moduleParts, ".") + "." + selector.Name, nil
}

func requirePythonUnittestResult(caseID, expectedTarget string, stderr []byte) error {
	type outcome struct {
		Method string
		Target string
		Status string
	}
	outcomes := []outcome{}
	summaryCount := 0
	runCount := ""
	okCount := 0
	unexpected := []string{}
	nonEmpty := []string{}
	for _, line := range strings.Split(strings.ReplaceAll(string(stderr), "\r\n", "\n"), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		nonEmpty = append(nonEmpty, trimmed)
		if match := pythonUnittestOutcome.FindStringSubmatch(trimmed); match != nil {
			outcomes = append(outcomes, outcome{Method: match[1], Target: match[2], Status: match[3]})
			continue
		}
		if match := pythonUnittestSummary.FindStringSubmatch(trimmed); match != nil {
			summaryCount++
			runCount = match[1]
			continue
		}
		if trimmed == "OK" {
			okCount++
			continue
		}
		if pythonSeparator.MatchString(trimmed) {
			continue
		}
		unexpected = append(unexpected, trimmed)
	}
	expectedMethod := expectedTarget[strings.LastIndex(expectedTarget, ".")+1:]
	finalOK := len(nonEmpty) > 0 && nonEmpty[len(nonEmpty)-1] == "OK"
	validOutcome := len(outcomes) == 1 && outcomes[0].Method == expectedMethod && outcomes[0].Target == expectedTarget && outcomes[0].Status == "ok"
	if !validOutcome || summaryCount != 1 || runCount != "1" || okCount != 1 || !finalOK || len(unexpected) != 0 {
		actual := map[string]any{
			"outcomes": outcomes, "summary_count": summaryCount, "run_count": runCount,
			"ok_count": okCount, "final_ok": finalOK, "unexpected": unexpected,
		}
		return diagnostic.New("AIDD_UNITTEST_RESULT", caseID, "build_verification", "Python unittest transcript must contain exactly one matching passed selector, one Ran 1 test summary, and final OK", map[string]any{"target": expectedTarget, "method": expectedMethod, "status": "ok", "ran": "1", "final": "OK"}, actual)
	}
	return nil
}

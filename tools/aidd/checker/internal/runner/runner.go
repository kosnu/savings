package runner

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

const Generator = "aidd-checker/v4"

type Options struct {
	ManualObservations map[string]string
}

func Execute(ctx context.Context, snapshot *repository.Snapshot, loaded *receipt.Loaded, options Options) (*model.BuildEvidence, error) {
	target := &loaded.Value.TargetState.Value
	initialFinalState, err := state.FinalHash(snapshot, target)
	if err != nil {
		return nil, err
	}
	evidence := &model.BuildEvidence{
		SchemaVersion:    model.EvidenceSchemaVersion,
		Kind:             "build_verification",
		Workspace:        loaded.Value.Workspace,
		ReceiptSHA256:    loaded.SHA256,
		CatalogSHA256:    loaded.Catalog.SHA256,
		FinalStateSHA256: initialFinalState,
		Generator:        Generator,
	}
	usedManual := map[string]struct{}{}
	for _, verificationCase := range target.VerificationCases {
		if verificationCase.Type == "manual" {
			observation, ok := options.ManualObservations[verificationCase.ID]
			if !ok || strings.TrimSpace(observation) == "" || strings.ContainsAny(observation, "\r\n") {
				return nil, diagnostic.New("AIDD_MANUAL_OBSERVATION", verificationCase.ID, "build_verification", "manual verification case requires one substantive single-line observation", nil, observation)
			}
			usedManual[verificationCase.ID] = struct{}{}
			evidence.Results = append(evidence.Results, model.VerificationResult{
				ID: verificationCase.ID, Type: "manual", Status: "passed",
				FinalStateSHA256: initialFinalState,
				Procedure:        verificationCase.Procedure, Observation: observation,
			})
			continue
		}
		profile := loaded.Catalog.Profiles[verificationCase.VerificationProfileID]
		profileHash := loaded.Catalog.ProfileHash[profile.ID]
		result, err := executeAutomated(ctx, snapshot, profile, profileHash, verificationCase, initialFinalState)
		if err != nil {
			return nil, err
		}
		evidence.Results = append(evidence.Results, *result)
		if err := snapshot.AssertUnchanged(); err != nil {
			return nil, diagnostic.New("AIDD_VERIFICATION_MUTATION", verificationCase.ID, "build_verification", "verification case modified a repository input", "unchanged snapshot", err.Error())
		}
		currentFinalState, err := state.FinalHash(snapshot, target)
		if err != nil {
			return nil, err
		}
		if currentFinalState != initialFinalState {
			return nil, diagnostic.New("AIDD_VERIFICATION_MUTATION", verificationCase.ID, "build_verification", "verification case modified the task-owned final state", initialFinalState, currentFinalState)
		}
	}
	manualIDs := make([]string, 0, len(options.ManualObservations))
	for id := range options.ManualObservations {
		manualIDs = append(manualIDs, id)
	}
	sort.Strings(manualIDs)
	for _, id := range manualIDs {
		if _, ok := usedManual[id]; !ok {
			return nil, diagnostic.New("AIDD_MANUAL_OBSERVATION_EXTRA", id, "build_verification", "manual observation names an unknown or automated case", nil, id)
		}
	}
	return evidence, nil
}

func executeAutomated(ctx context.Context, snapshot *repository.Snapshot, profile model.VerificationProfile, profileHash string, verificationCase model.VerificationCase, finalState string) (*model.VerificationResult, error) {
	if profile.Contract == "test_case" {
		if err := requireRegularSelectorFile(snapshot, verificationCase.Selector.Path); err != nil {
			return nil, err
		}
	}
	arguments := append([]string(nil), profile.Argv...)
	workingDirectory := snapshot.Root
	if profile.WorkingDirectory != "" {
		resolvedWorkingDirectory, err := snapshot.ResolveDirectory(profile.WorkingDirectory)
		if err != nil {
			return nil, err
		}
		workingDirectory = resolvedWorkingDirectory
	}
	var resultFile string
	if profile.Runner == "vitest_json" {
		temporary, err := os.CreateTemp("", "aidd-vitest-*.json")
		if err != nil {
			return nil, diagnostic.New("AIDD_RUNNER_TEMP", verificationCase.ID, "build_verification", "Vitest result file cannot be created", nil, err.Error())
		}
		resultFile = temporary.Name()
		_ = temporary.Close()
		defer os.Remove(resultFile)
		selectorPath, err := selectorPath(profile, *verificationCase.Selector)
		if err != nil {
			return nil, err
		}
		arguments = vitestArguments(arguments, resultFile, selectorPath, verificationCase.Selector.Name)
	} else if profile.Runner == "python_unittest" {
		target, err := pythonUnittestTarget(*verificationCase.Selector)
		if err != nil {
			return nil, err
		}
		arguments = append(arguments, target)
	}
	command := exec.CommandContext(ctx, arguments[0], arguments[1:]...)
	command.Dir = workingDirectory
	command.Env = fixedEnvironment(os.Environ())
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr
	runErr := command.Run()
	exitCode := 0
	if runErr != nil {
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, diagnostic.New("AIDD_RUNNER_START", verificationCase.ID, "build_verification", "verification runner could not start", profile.Argv, runErr.Error())
		}
	}
	identities, parseErr := parseRuntimeIdentities(snapshot, profile, verificationCase, stdout.Bytes(), stderr.Bytes(), resultFile)
	if parseErr != nil {
		return nil, parseErr
	}
	if exitCode != 0 {
		return nil, diagnostic.New("AIDD_VERIFICATION_EXIT", verificationCase.ID, "build_verification", "verification profile failed", 0, exitCode)
	}
	digest := outputHash(stdout.Bytes(), stderr.Bytes())
	stdoutBytes := stdout.Len()
	stderrBytes := stderr.Len()
	return &model.VerificationResult{
		ID: verificationCase.ID, Type: "automated", Status: "passed",
		VerificationProfileID: profile.ID, ProfileSHA256: profileHash,
		Selector: verificationCase.Selector, ExecutedIdentities: identities,
		ExitCode: &exitCode, StdoutBytes: &stdoutBytes, StderrBytes: &stderrBytes,
		OutputSHA256: digest, FinalStateSHA256: finalState,
	}, nil
}

func vitestArguments(base []string, resultFile, selectorPath, testName string) []string {
	return append(base, "--reporter=json", "--outputFile="+resultFile, selectorPath, "--testNamePattern=^"+regexp.QuoteMeta(testName)+"$")
}

func requireRegularSelectorFile(snapshot *repository.Snapshot, selector string) error {
	if _, err := repository.ValidateRelativePath(selector); err != nil {
		return diagnostic.New("AIDD_SELECTOR_PATH", selector, "build_verification", "selector must be a canonical repository-relative path", nil, err.Error())
	}
	mode, exists, err := snapshot.Mode(selector)
	if err != nil {
		return err
	}
	if !exists || !mode.IsRegular() {
		actual := "not found"
		if exists {
			actual = mode.String()
		}
		return diagnostic.New("AIDD_SELECTOR_FILE", selector, "build_verification", "selector target must be a regular file", "regular file", actual)
	}
	return nil
}

func selectorPath(profile model.VerificationProfile, selector model.Selector) (string, error) {
	if profile.SelectorRoot == "" {
		return selector.Path, nil
	}
	prefix := profile.SelectorRoot + "/"
	if !strings.HasPrefix(selector.Path, prefix) {
		return "", diagnostic.New("AIDD_SELECTOR_ROOT", selector.Path, "build_verification", "selector path is outside the profile selector root", profile.SelectorRoot, selector.Path)
	}
	return strings.TrimPrefix(selector.Path, prefix), nil
}

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
			if _, err := repository.ValidateRelativePath(repositoryPath); err != nil {
				return nil, diagnostic.New("AIDD_VITEST_PATH", verificationCase.ID, "build_verification", "Vitest reported a non-canonical repository path", nil, file.Name)
			}
			if err := requireRegularSelectorFile(snapshot, repositoryPath); err != nil {
				return nil, err
			}
			for _, assertion := range file.AssertionResults {
				identity := model.RuntimeIdentity{Kind: "test_case", Path: repositoryPath, Name: assertion.FullName}
				if assertion.Status != "passed" {
					return nil, diagnostic.New("AIDD_VITEST_STATUS", verificationCase.ID, "build_verification", "every structured Vitest assertion must report passed", "passed", map[string]any{"identity": identity, "status": assertion.Status})
				}
				identities = append(identities, identity)
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

func fixedEnvironment(source []string) []string {
	fixed := map[string]string{
		"CLICOLOR":                "0",
		"FORCE_COLOR":             "0",
		"LANG":                    "C",
		"LC_ALL":                  "C",
		"NO_COLOR":                "1",
		"PYTHONHASHSEED":          "0",
		"PYTHON_COLORS":           "0",
		"PYTHONDONTWRITEBYTECODE": "1",
	}
	result := make([]string, 0, len(source)+len(fixed))
	for _, entry := range source {
		key, _, found := strings.Cut(entry, "=")
		if found {
			if _, replaced := fixed[key]; replaced {
				continue
			}
		}
		result = append(result, entry)
	}
	keys := make([]string, 0, len(fixed))
	for key := range fixed {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		result = append(result, key+"="+fixed[key])
	}
	return result
}

func outputHash(stdout, stderr []byte) string {
	var framed bytes.Buffer
	framed.WriteString("AIDD-output-v1")
	framed.WriteByte(0)
	_ = binary.Write(&framed, binary.BigEndian, uint64(len(stdout)))
	framed.Write(stdout)
	_ = binary.Write(&framed, binary.BigEndian, uint64(len(stderr)))
	framed.Write(stderr)
	digest := sha256.Sum256(framed.Bytes())
	return hex.EncodeToString(digest[:])
}

func ParseManualObservations(values []string) (map[string]string, error) {
	result := map[string]string{}
	for _, value := range values {
		id, observation, found := strings.Cut(value, "=")
		if !found || id == "" || strings.TrimSpace(observation) == "" {
			return nil, fmt.Errorf("manual observation must use VC-ID=text")
		}
		if _, duplicate := result[id]; duplicate {
			return nil, fmt.Errorf("manual observation ID must be unique: %s", id)
		}
		result[id] = observation
	}
	return result, nil
}

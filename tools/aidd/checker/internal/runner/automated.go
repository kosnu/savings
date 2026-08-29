package runner

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

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
		defer os.Remove(resultFile)
		if err := temporary.Close(); err != nil {
			return nil, diagnostic.New("AIDD_RUNNER_TEMP", verificationCase.ID, "build_verification", "Vitest result file cannot be closed before execution", nil, err.Error())
		}
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
	runErr, residualProcess, cleanupErr := runVerificationCommand(command)
	if cleanupErr != nil {
		return nil, diagnostic.New("AIDD_VERIFICATION_PROCESS_CLEANUP", verificationCase.ID, "build_verification", "verification runner process group could not be terminated", "no residual verification process", cleanupErr.Error())
	}
	if residualProcess {
		return nil, diagnostic.New("AIDD_VERIFICATION_PROCESS_LEAK", verificationCase.ID, "build_verification", "verification runner left a residual process after its direct process exited", "no residual verification process", profile.Argv)
	}
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
	if _, err := pathcontract.ValidateRelativePath(selector); err != nil {
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

func fixedEnvironment(source []string) []string {
	source = repository.CanonicalGitEnvironment(source, nil)
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
	var length [8]byte
	binary.BigEndian.PutUint64(length[:], uint64(len(stdout)))
	framed.Write(length[:])
	framed.Write(stdout)
	binary.BigEndian.PutUint64(length[:], uint64(len(stderr)))
	framed.Write(length[:])
	framed.Write(stderr)
	digest := sha256.Sum256(framed.Bytes())
	return hex.EncodeToString(digest[:])
}

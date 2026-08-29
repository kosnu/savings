package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/phasecontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

const version = "0.1.0"

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		_, _ = os.Stderr.Write(diagnostic.JSON(err))
		_, _ = os.Stderr.Write([]byte("\n"))
		os.Exit(1)
	}
}

func run(ctx context.Context, arguments []string) error {
	if len(arguments) == 0 {
		return diagnostic.New("AIDD_CLI_COMMAND", "", "cli", "a subcommand is required", commands(), nil)
	}
	switch arguments[0] {
	case "version":
		if len(arguments) != 1 {
			return diagnostic.New("AIDD_CLI_FLAGS", "version", "cli", "version does not accept arguments", "no arguments", arguments[1:])
		}
		fmt.Printf("aidd-checker %s\n", version)
		return nil
	case "validate-source":
		return validateSource(arguments[1:])
	case "workspace":
		return resolveWorkspace(ctx, arguments[1:])
	case "render":
		return renderSource(ctx, arguments[1:])
	case "check-all":
		return checkAll(ctx, arguments[1:])
	case "validate-requirements":
		return validateRequirements(ctx, arguments[1:])
	case "validate-design":
		return validateDesign(ctx, arguments[1:])
	case "capture-design":
		return captureDesign(ctx, arguments[1:])
	case "build-entry":
		return buildEntry(ctx, arguments[1:])
	case "capture-verification":
		return captureVerification(ctx, arguments[1:])
	case "validate-build":
		return validateBuild(ctx, arguments[1:])
	case "validate-phase-contract":
		return validatePhaseContract(ctx, arguments[1:])
	default:
		return diagnostic.New("AIDD_CLI_COMMAND", arguments[0], "cli", "subcommand is unsupported", commands(), arguments[0])
	}
}

func commands() []string {
	return []string{"workspace", "render", "validate-source", "validate-requirements", "validate-design", "check-all", "capture-design", "build-entry", "capture-verification", "validate-build", "validate-phase-contract", "version"}
}

func validatePhaseContract(ctx context.Context, arguments []string) error {
	flags := newFlagSet("validate-phase-contract")
	repoRoot := flags.String("repo-root", "", "repository root")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "validate-phase-contract", "cli", "validate-phase-contract requires --repo-root", "non-empty repository root", *repoRoot)
	}
	if err := phasecontract.Validate(ctx, *repoRoot); err != nil {
		return err
	}
	fmt.Printf("AIDD phase contract: verified: %s\n", phasecontract.ID)
	return nil
}

func newFlagSet(name string) *flag.FlagSet {
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	return flags
}

func parseFlags(flags *flag.FlagSet, arguments []string) error {
	if err := flags.Parse(arguments); err != nil {
		return diagnostic.New("AIDD_CLI_FLAGS", flags.Name(), "cli", "command arguments are invalid", "declared flags only", err.Error())
	}
	if flags.NArg() != 0 {
		return diagnostic.New("AIDD_CLI_FLAGS", flags.Name(), "cli", "unexpected positional arguments are not allowed", "flags only", flags.Args())
	}
	return nil
}

func readCanonicalWorkspaceSource(snapshot *repository.Snapshot, workspace, filename, providedPath, flagName string) ([]byte, error) {
	expectedPath, err := repository.WorkspacePath(workspace, filename)
	if err != nil {
		return nil, err
	}
	expectedAbsolute := filepath.Join(snapshot.Root, filepath.FromSlash(expectedPath))
	actual := filepath.Clean(providedPath)
	if actual != filepath.Clean(expectedPath) && actual != expectedAbsolute {
		return nil, diagnostic.New("AIDD_CLI_ARTIFACT_PATH", flagName, "cli", "artifact validation requires the canonical workspace source", []string{expectedPath, expectedAbsolute}, providedPath)
	}
	return snapshot.Read(expectedPath)
}

type repeatedFlag []string

func (values *repeatedFlag) String() string {
	copyValues := append([]string(nil), *values...)
	sort.Strings(copyValues)
	return strings.Join(copyValues, ",")
}

func (values *repeatedFlag) Set(value string) error {
	*values = append(*values, value)
	return nil
}

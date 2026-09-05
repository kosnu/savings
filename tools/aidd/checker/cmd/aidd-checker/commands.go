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
	"github.com/kosnu/savings/tools/aidd/checker/internal/protocol"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

const version = "0.2.0"

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
	case "check-all":
		if err := checkConfig(ctx, arguments[1:]); err != nil {
			return err
		}
		return checkAll(ctx, arguments[1:])
	case "check-config":
		return checkConfig(ctx, arguments[1:])
	case "validate-source":
		return validateSource(arguments[1:])
	case "task-start", "checkpoint", "verify", "check", "ship-check", "finish", "learn-review", "ci-check", "bootstrap-check":
		return protocolCommand(ctx, arguments[0], arguments[1:])
	default:
		return diagnostic.New("AIDD_PROTOCOL_RETIRED", arguments[0], "cli", "Legacy phase execution is retired; use v5 task/checkpoint contracts", commands(), arguments[0])
	}
}
func commands() []string {
	return []string{"task-start", "checkpoint", "verify", "check", "ship-check", "finish", "learn-review", "ci-check", "bootstrap-check", "validate-source", "check-config", "check-all", "version"}
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

func checkConfig(ctx context.Context, args []string) error {
	flags := newFlagSet("check-config")
	root := flags.String("repo-root", "", "repository root")
	if err := parseFlags(flags, args); err != nil {
		return err
	}
	if *root == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "repo-root", "cli", "--repo-root is required", nil, nil)
	}
	snapshot, err := repository.Open(ctx, *root)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	return protocol.CheckConfiguration(ctx, snapshot)
}

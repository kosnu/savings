package main

import (
	"context"
	"fmt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

// 廃止した公開経路は回帰testからだけ呼ぶ。
func runHistorical(ctx context.Context, arguments []string) error {
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
	case "validate-ship":
		return validateShip(ctx, arguments[1:])
	default:
		return diagnostic.New("AIDD_CLI_COMMAND", arguments[0], "cli", "subcommand is unsupported", commands(), arguments[0])
	}
}

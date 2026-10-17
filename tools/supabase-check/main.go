package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"time"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()
	ctx, timeout := context.WithTimeout(ctx, 25*time.Minute)
	defer timeout()
	if err := run(ctx, os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "supabase-check:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return errors.New("local | dev | assets | preview-build が必要です")
	}
	fs := flag.NewFlagSet(args[0], flag.ContinueOnError)
	root := fs.String("root", ".", "repository root")
	dir := fs.String("dir", "apps/web/.cloudflare/output/v0/workers/default/assets", "assets directory")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	abs, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	switch args[0] {
	case "local":
		return local(ctx, abs)
	case "dev":
		return dev(ctx, abs)
	case "preview-build":
		for _, task := range [][]string{{"node", "tools/dev-preview/preview.mjs", "name", "ci/preview"}, {"pnpm", "run", "web:build", "--mode", "development"}, {"node", "tools/dev-preview/preview.mjs", "check-build"}} {
			if _, err := command(ctx, abs, "", task[0], task[1:]...); err != nil {
				return err
			}
		}
		return scanDirectory(filepath.Join(abs, *dir), secretValues())
	case "assets":
		return scanDirectory(filepath.Join(abs, *dir), secretValues())
	default:
		return errors.New("未対応のcommand")
	}
}

package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/migration"
	"os"
)

func main() {
	approved := flag.Bool("approved", false, "require GitHub approval after the environment gate")
	flag.Parse()
	ctx := context.Background()
	m, err := migration.ParseRequest(os.Getenv("PR_BODY"))
	if err == nil {
		err = migration.CheckScope(ctx, os.Getenv("GITHUB_WORKSPACE"), os.Getenv("PR_BASE_SHA"), os.Getenv("PR_HEAD_SHA"), m)
	}
	if err == nil {
		err = migration.CheckApproval(migration.GitHubAPI(ctx), os.Getenv("GITHUB_REPOSITORY"), os.Getenv("PR_NUMBER"), os.Getenv("GITHUB_RUN_ID"), os.Getenv("PR_BASE_SHA"), os.Getenv("PR_HEAD_SHA"), os.Getenv("PR_BODY"), *approved)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("AIDD contract migration: task=%s base=%s head=%s approved=%t\nReason: %s\n", m.TaskID, os.Getenv("PR_BASE_SHA"), os.Getenv("PR_HEAD_SHA"), *approved, m.Reason)
}

package main

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/protocol"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
)

func protocolCommand(ctx context.Context, command string, args []string) error {
	flags := newFlagSet(command)
	root := flags.String("repo-root", "", "canonical repository")
	base := flags.String("base", "", "PR merge-base commit")
	id := flags.String("task", "", "task ID")
	taskHash := flags.String("task-sha256", "", "task identity")
	checkpoint := flags.String("checkpoint-sha256", "", "latest checkpoint (parent for checkpoint)")
	evidenceHash := flags.String("evidence-sha256", "", "verification identity")
	source := flags.String("source", "", "external input JSON")
	sourceHash := flags.String("source-sha256", "", "external review identity")
	var manual repeatedFlag
	flags.Var(&manual, "manual-observation", "VC-ID=observation")
	if err := parseFlags(flags, args); err != nil {
		return err
	}
	if *root == "" {
		return fmt.Errorf("--repo-root is required")
	}
	snapshot, err := repository.Open(ctx, *root)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	var content []byte
	if *source != "" {
		absolute, err := filepath.Abs(*source)
		if err != nil {
			return err
		}
		resolved, err := filepath.EvalSymlinks(absolute)
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(snapshot.Root, resolved)
		if err != nil {
			return err
		}
		if relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return fmt.Errorf("source must be an external regular file")
		}
		content, err = repository.ReadExternal(absolute)
		if err != nil {
			return err
		}
	}
	var digest string
	switch command {
	case "bootstrap-check":
		err = protocol.CheckBootstrap(ctx, snapshot, *base)
	case "ci-check":
		err = protocol.CheckDelivery(ctx, snapshot, *base, *id)
	case "task-start":
		var spec protocol.Spec
		if err = canonical.Decode(content, "task_spec", &spec); err == nil {
			digest, err = protocol.Start(ctx, snapshot, spec)
		}
	case "checkpoint":
		var decision protocol.Decision
		if err = canonical.Decode(content, "decision", &decision); err == nil {
			digest, err = protocol.CheckpointDecision(ctx, snapshot, *id, *taskHash, *checkpoint, decision)
		}
	default:
		var loaded *protocol.Loaded
		loaded, err = protocol.Load(ctx, snapshot, *id, *taskHash, *checkpoint)
		if err != nil {
			return err
		}
		switch command {
		case "verify":
			var observations map[string]string
			observations, err = runner.ParseManualObservations(manual)
			if err == nil {
				digest, err = protocol.Verify(ctx, snapshot, loaded, runner.Options{ManualObservations: observations})
			}
		case "check":
			_, err = protocol.ValidateEvidence(ctx, snapshot, loaded, *evidenceHash)
		case "finish":
			err = protocol.Finish(ctx, snapshot, loaded, *evidenceHash)
		case "ship-check":
			err = protocol.Ship(ctx, snapshot, loaded, *evidenceHash)
		case "learn-review":
			if canonical.HashBytes(content) != *sourceHash {
				return fmt.Errorf("external review SHA-256 mismatch")
			}
			var review protocol.Review
			if err = canonical.Decode(content, "learn_review", &review); err == nil {
				digest, err = protocol.RecordLearnReview(ctx, snapshot, loaded, *evidenceHash, review)
			}
		}
	}
	if err != nil {
		return err
	}
	fmt.Printf("AIDD v5 %s: verified %s\n", command, digest)
	return nil
}

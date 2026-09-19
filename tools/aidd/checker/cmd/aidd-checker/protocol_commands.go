package main

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/protocol"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
)

func protocolCommand(ctx context.Context, command string, args []string) (resultErr error) {
	flags := newFlagSet(command)
	root := flags.String("repo-root", "", "canonical repository")
	base := flags.String("base", "", "PR merge-base commit")
	targetBase := flags.String("target-base", "", "current PR target base commit (CI / bootstrap)")
	id := flags.String("task", "", "task ID")
	taskHash := flags.String("task-sha256", "", "task identity")
	checkpoint := flags.String("checkpoint-sha256", "", "latest checkpoint (parent for checkpoint)")
	evidenceHash := flags.String("evidence-sha256", "", "verification identity")
	source := flags.String("source", "", "external input JSON")
	sourceHash := flags.String("source-sha256", "", "external review identity")
	latest := flags.Bool("latest", false, "resolve identities for explicit task and expected revision")
	revision := flags.Int("expect-revision", -1, "expected current checkpoint revision")
	field := flags.String("field", "summary", "task-status field")
	offset := flags.Int("offset", 0, "task-status character offset")
	limit := flags.Int("limit", 2000, "task-status page characters (max 4000)")
	migration := flags.Bool("contract-migration", false, "candidate validation for explicitly approved contract migration")
	diagnosticOffset := flags.Int("diagnostic-offset", 0, "error detail character offset on this execution")
	diagnosticLimit := flags.Int("diagnostic-limit", 2000, "error detail characters (max 4000)")
	defer func() {
		if resultErr != nil {
			resultErr = protocolDiagnostic(resultErr, *diagnosticOffset, *diagnosticLimit)
		}
	}()
	var manual repeatedFlag
	flags.Var(&manual, "manual-observation", "VC-ID=observation")
	if err := parseFlags(flags, args); err != nil {
		return err
	}
	if *diagnosticOffset < 0 || *diagnosticLimit < 1 || *diagnosticLimit > 4000 {
		return fmt.Errorf("invalid diagnostic page range")
	}
	if *migration && command != "ci-check" {
		return fmt.Errorf("--contract-migration is only valid with ci-check")
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
	if command == "task-status" {
		page, err := protocol.Inspect(ctx, snapshot, *id, *field, *offset, *limit)
		if err != nil {
			return err
		}
		b, err := canonical.Pretty(page)
		if err != nil {
			return err
		}
		fmt.Print(string(b))
		return nil
	}
	if *latest {
		switch command {
		case "checkpoint", "verify", "check", "finish", "ship-check", "learn-review":
		default:
			return fmt.Errorf("--latest is not supported for %s", command)
		}
		if *revision < 0 {
			return fmt.Errorf("--latest requires --expect-revision")
		}
		l, eh, err := protocol.Resolve(ctx, snapshot, *id, *revision)
		if err != nil {
			return err
		}
		if (*taskHash != "" && *taskHash != l.TaskHash) || (*checkpoint != "" && *checkpoint != l.CheckpointHash) || (*evidenceHash != "" && *evidenceHash != eh) {
			return fmt.Errorf("explicit identity does not match current task")
		}
		*taskHash = l.TaskHash
		*checkpoint = l.CheckpointHash
		*evidenceHash = eh
	}
	var digest string
	switch command {
	case "bootstrap-check":
		err = protocol.CheckBootstrap(ctx, snapshot, *base, *targetBase)
	case "ci-check":
		if *migration {
			err = protocol.CheckMigrationDelivery(ctx, snapshot, *base, *id, *targetBase)
		} else {
			err = protocol.CheckDelivery(ctx, snapshot, *base, *id, *targetBase)
		}
	case "decision-update":
		if *taskHash != "" || *checkpoint != "" || *evidenceHash != "" {
			return fmt.Errorf("decision-update uses --task and --expect-revision")
		}
		var update protocol.DecisionUpdate
		if err = canonical.Decode(content, "decision_update", &update); err == nil {
			digest, err = protocol.UpdateDecision(ctx, snapshot, *id, *revision, update)
		}
	case "task-start":
		var spec protocol.Spec
		if err = canonical.Decode(content, "task_spec", &spec); err == nil {
			if spec.SchemaVersion == 0 {
				spec.SchemaVersion = protocol.CompactVersion
			}
			if spec.SchemaVersion != protocol.CompactVersion {
				return diagnostic.New("AIDD_VNEXT_PROTOCOL", "schema_version", "task_spec", "new task-start requires schema v6", protocol.CompactVersion, spec.SchemaVersion)
			}
			if spec.Intent.BodySHA256 == "" {
				spec.Intent.BodySHA256 = canonical.HashBytes([]byte(spec.Intent.Body))
			}
			digest, err = protocol.Start(ctx, snapshot, spec)
		}
	case "checkpoint":
		var decision protocol.Decision
		if err = canonical.Decode(content, "decision", &decision); err == nil {
			if *latest {
				l, _, resolveErr := protocol.Resolve(ctx, snapshot, *id, *revision)
				if resolveErr != nil {
					return resolveErr
				}
				if decision.SchemaVersion == 0 {
					decision.SchemaVersion = l.Task.SchemaVersion
				}
				if decision.Kind == "" {
					decision.Kind = "decision"
				}
				if decision.TaskSHA256 == "" {
					decision.TaskSHA256 = l.TaskHash
				}
			}
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
	fmt.Printf("AIDD %s: verified %s\n", command, digest)
	return nil
}

// 失敗理由の全文を通常出力へ流さず、元の診断codeと明示的な継続位置を返す。
func protocolDiagnostic(err error, offset, limit int) error {
	raw := []rune(string(diagnostic.JSON(err)))
	if limit < 1 || limit > 4000 {
		limit = 2000
	}
	if offset < 0 || offset > len(raw) {
		offset = 0
	}
	end := min(offset+limit, len(raw))
	var next *int
	if end < len(raw) {
		next = &end
	}
	code := "AIDD_INTERNAL"
	var d *diagnostic.Diagnostic
	if errors.As(err, &d) {
		code = d.Code
	}
	page := struct {
		Offset  int    `json:"offset"`
		Total   int    `json:"total_characters"`
		Next    *int   `json:"next_offset"`
		Content string `json:"content"`
	}{offset, len(raw), next, string(raw[offset:end])}
	return diagnostic.New(code, "", "protocol", "検査失敗。診断の続きは --diagnostic-offset で明示取得できます（再実行時の状態に依存）", nil, page)
}

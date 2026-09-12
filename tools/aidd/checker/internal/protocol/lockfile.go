package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/adapters/pnpm"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"strings"
)

const lockPath = "pnpm-lock.yaml"

func (l *Loaded) toolNames() map[string]bool {
	result := map[string]bool{}
	for _, rule := range l.Policy.MixedJSON {
		for _, pointer := range rule.GuardFields {
			parts, err := pointerParts(pointer)
			if err == nil && len(parts) == 2 && (strings.HasSuffix(parts[0], "Dependencies") || parts[0] == "dependencies") {
				result[parts[1]] = true
			}
		}
	}
	return result
}

func (l *Loaded) checkLock(ctx context.Context, s *repository.Snapshot, files []File) error {
	before, ok := fileMap(l.changeBaseline())[lockPath]
	after, exists := fileMap(files)[lockPath]
	if !ok || !exists || before.Type != "regular" || after.Type != "regular" || transportFiles([]File{before}, l.gitComparison())[0].Mode != transportFiles([]File{after}, l.gitComparison())[0].Mode {
		return fail("LOCKFILE", lockPath, "既存lockfileのtype/modeを保持してください")
	}
	if l.Task.Spec.Kind == "learn" && !owned(lockPath, l.authorizedScopes()) {
		return fail("LEARN_SCOPE", lockPath, "lockfileの明示ownershipが必要です")
	}
	old, err := s.Git(ctx, "show", l.changeBaseHead()+":"+lockPath)
	if err != nil {
		return err
	}
	next, err := s.Read(lockPath)
	if err != nil {
		return err
	}

	comparison, err := pnpm.Compare(old, next, l.toolNames(), l.Task.Spec.Kind == "development")
	if err != nil {
		return err
	}
	if comparison.ClosureChanged {
		return fail("LOCKFILE_BOUNDARY", lockPath, "他方の依存宣言・resolution・推移依存を変更しています")
	}
	if l.Task.Spec.Kind == "development" {
		if comparison.ToolchainChanged {
			return fail("LOCKFILE_BOUNDARY", lockPath, "package manager/config依存はguardrailです")
		}
		if comparison.SettingsChanged {
			return fail("GUARDRAIL_DRIFT", lockPath, "lockfileのsettings/catalog/overrideはguardrailです")
		}
	}
	return nil
}

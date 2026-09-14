package protocol

import (
	"context"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

// Taskの件数ではなく、各Taskが記録した担当範囲で実差分を分担する。
func changedTaskIDs(paths []string) ([]string, error) {
	ids := map[string]bool{}
	for _, path := range paths {
		if !strings.HasPrefix(path, TaskRoot+"/") {
			continue
		}
		parts := strings.Split(path, "/")
		if len(parts) < 4 {
			return nil, fail("OUTPUT", path, "Taskに属さない出力です")
		}
		if err := pathcontract.ValidateWorkspaceName(parts[2]); err != nil {
			return nil, err
		}
		ids[parts[2]] = true
	}
	result := []string{}
	for id := range ids {
		result = append(result, id)
	}
	sort.Strings(result)
	return result, nil
}

func (l *Loaded) loadPeerScopes(ctx context.Context, s *repository.Snapshot) error {
	files, err := inventory(ctx, s)
	if err != nil {
		return err
	}
	ids, err := changedTaskIDs(changed(transportFiles(l.changeBaseline(), l.gitComparison()), transportFiles(files, l.gitComparison())))
	if err != nil {
		return err
	}
	l.PeerScopes = nil
	for _, id := range ids {
		if id == l.Task.Spec.ID {
			continue
		}
		_, digest, err := readMode[Task](s, taskPath(id, "task.json"), l.Delivered)
		if err != nil {
			return err
		}
		peer, err := loadTaskMode(s, id, digest, l.Delivered)
		if err != nil {
			return err
		}
		if err = loadCheckpoints(s, peer); err != nil {
			return err
		}
		if peer.CheckpointHash == "" {
			return fail("CHECKPOINT", id, "担当範囲を示すcheckpointがありません")
		}
		l.PeerScopes = append(l.PeerScopes, peer.Checkpoint.Decision.Target.OwnershipScopes...)
	}
	return nil
}

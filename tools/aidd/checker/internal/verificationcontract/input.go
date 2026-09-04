package verificationcontract

import (
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

// Inputは実行者やGoalによらない、checkpoint固定の検証入力。
type Input struct {
	SchemaVersion    int
	Generator        string
	Workspace        string
	CheckpointSHA256 string
	BaselineHead     string
	Target           model.TargetState
	Catalog          *catalog.Resolved
}

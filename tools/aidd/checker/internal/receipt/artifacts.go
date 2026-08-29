package receipt

import (
	"fmt"
	"regexp"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

var artifactModePattern = regexp.MustCompile(`^0[0-7]{3}$`)

const canonicalReceiptMode = "0600"

func ValidateReceiptMode(snapshot *repository.Snapshot, path, artifact string) error {
	currentMode, err := artifactMode(snapshot, path, artifact)
	if err != nil {
		return err
	}
	if currentMode != canonicalReceiptMode {
		return diagnostic.New("AIDD_RECEIPT_MODE_DRIFT", path, artifact, "Design completion receipt must keep the canonical output mode", canonicalReceiptMode, currentMode)
	}
	return nil
}

func CaptureArtifactIdentity(snapshot *repository.Snapshot, path string, content []byte) (model.ArtifactIdentity, error) {
	mode, err := artifactMode(snapshot, path, "design_completion")
	if err != nil {
		return model.ArtifactIdentity{}, err
	}
	return model.ArtifactIdentity{Path: path, SHA256: canonical.HashBytes(content), Mode: mode}, nil
}

func ValidateArtifacts(snapshot *repository.Snapshot, workspace string, artifacts model.ReceiptArtifacts, artifact string) error {
	records := []struct {
		label    string
		filename string
		record   model.ArtifactIdentity
	}{
		{label: "requirements.source", filename: "requirements.json", record: artifacts.Requirements.Source},
		{label: "requirements.display", filename: "requirements.md", record: artifacts.Requirements.Display},
		{label: "design.source", filename: "design-doc.json", record: artifacts.Design.Source},
		{label: "design.display", filename: "design-doc.md", record: artifacts.Design.Display},
	}
	for _, item := range records {
		expectedPath, err := repository.WorkspacePath(workspace, item.filename)
		if err != nil {
			return err
		}
		if item.record.Path != expectedPath {
			return diagnostic.New("AIDD_ARTIFACT_PATH", item.label+".path", artifact, "receipt artifact path is not canonical", expectedPath, item.record.Path)
		}
		if !artifactModePattern.MatchString(item.record.Mode) {
			return diagnostic.New("AIDD_ARTIFACT_MODE", item.label+".mode", artifact, "receipt artifact mode must be a fixed regular-file permission mode", "four octal digits", item.record.Mode)
		}
		content, err := snapshot.Read(item.record.Path)
		if err != nil {
			return err
		}
		if currentHash := canonical.HashBytes(content); currentHash != item.record.SHA256 {
			return diagnostic.New("AIDD_ARTIFACT_DRIFT", item.record.Path, artifact, "receipt-pinned artifact content changed after Design completion", item.record.SHA256, currentHash)
		}
		currentMode, err := artifactMode(snapshot, item.record.Path, artifact)
		if err != nil {
			return err
		}
		if currentMode != item.record.Mode {
			return diagnostic.New("AIDD_ARTIFACT_MODE_DRIFT", item.record.Path, artifact, "receipt-pinned artifact mode changed after Design completion", item.record.Mode, currentMode)
		}
	}
	return nil
}

func artifactMode(snapshot *repository.Snapshot, path, artifact string) (string, error) {
	mode, exists, err := snapshot.Mode(path)
	if err != nil {
		return "", err
	}
	if !exists || !mode.IsRegular() {
		actual := "missing"
		if exists {
			actual = mode.String()
		}
		return "", diagnostic.New("AIDD_ARTIFACT_TYPE", path, artifact, "receipt artifact must be a regular file", "regular file", actual)
	}
	return fmt.Sprintf("%04o", mode.Perm()), nil
}

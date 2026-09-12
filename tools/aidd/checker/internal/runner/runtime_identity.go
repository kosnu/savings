package runner

import (
	"github.com/kosnu/savings/tools/aidd/checker/internal/adapters/testrunner"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func parseRuntimeIdentities(s *repository.Snapshot, p model.VerificationProfile, c model.VerificationCase, stdout, stderr []byte, file string) ([]model.RuntimeIdentity, error) {
	return testrunner.ParseIdentities(s, p, c, stdout, stderr, file, requireRegularSelectorFile)
}

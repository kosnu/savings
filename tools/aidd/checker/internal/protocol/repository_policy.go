package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repositorypolicy"
)

func taskRepositoryPolicy(s *repository.Snapshot, t Task) (repositorypolicy.Policy, error) {
	f, exists := fileMap(t.Baseline)[repositorypolicy.Path]
	if !exists {
		return repositorypolicy.Legacy(), nil
	}
	if f.Type != "regular" {
		return repositorypolicy.Policy{}, fail("POLICY", repositorypolicy.Path, "開始時policyはregular fileでなければなりません")
	}
	data, err := s.Git(context.Background(), "show", t.BaselineHead+":"+repositorypolicy.Path)
	if err != nil {
		return repositorypolicy.Policy{}, err
	}
	if canonical.HashBytes(data) != f.SHA256 {
		return repositorypolicy.Policy{}, fail("POLICY", repositorypolicy.Path, "開始時inventoryとpolicy bytesが一致しません")
	}
	return repositorypolicy.Parse(data)
}

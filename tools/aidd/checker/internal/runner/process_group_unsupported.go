//go:build !darwin && !linux

package runner

import "os/exec"

func configureVerificationProcessGroup(_ *exec.Cmd) {}

func cleanupVerificationProcessGroup(_ *exec.Cmd) (bool, error) {
	return false, nil
}

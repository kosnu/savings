//go:build !darwin && !linux

package core

import (
	"fmt"
	"os/exec"
)

func runVerification(c *exec.Cmd) ([]byte, error) {
	return nil, fmt.Errorf("verification process cleanup is supported on macOS and Linux only")
}

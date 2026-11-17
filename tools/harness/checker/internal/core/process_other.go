//go:build !darwin && !linux

package core

import (
	"fmt"
	"os/exec"
)

func runProcessGroup(c *exec.Cmd, operation string) error {
	return fmt.Errorf("%s process cleanup is supported on macOS and Linux only", operation)
}

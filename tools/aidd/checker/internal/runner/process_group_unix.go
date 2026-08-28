//go:build darwin || linux

package runner

import (
	"errors"
	"os/exec"
	"syscall"
	"time"
)

const verificationProcessCleanupTimeout = time.Second

func configureVerificationProcessGroup(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func cleanupVerificationProcessGroup(command *exec.Cmd) (bool, error) {
	if command.Process == nil {
		return false, nil
	}
	processGroupID := command.Process.Pid
	alive, err := verificationProcessGroupAlive(processGroupID)
	if err != nil || !alive {
		return false, err
	}
	if err := syscall.Kill(-processGroupID, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
		return true, err
	}
	gone, err := waitForVerificationProcessGroup(processGroupID, verificationProcessCleanupTimeout)
	if err != nil || gone {
		return true, err
	}
	if err := syscall.Kill(-processGroupID, syscall.SIGKILL); err != nil && !errors.Is(err, syscall.ESRCH) {
		return true, err
	}
	gone, err = waitForVerificationProcessGroup(processGroupID, verificationProcessCleanupTimeout)
	if err != nil {
		return true, err
	}
	if !gone {
		return true, syscall.EBUSY
	}
	return true, nil
}

func waitForVerificationProcessGroup(processGroupID int, timeout time.Duration) (bool, error) {
	deadline := time.Now().Add(timeout)
	for {
		alive, err := verificationProcessGroupAlive(processGroupID)
		if err != nil || !alive {
			return !alive, err
		}
		if time.Now().After(deadline) {
			return false, nil
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func verificationProcessGroupAlive(processGroupID int) (bool, error) {
	err := syscall.Kill(-processGroupID, 0)
	if err == nil || errors.Is(err, syscall.EPERM) {
		return true, nil
	}
	if errors.Is(err, syscall.ESRCH) {
		return false, nil
	}
	return false, err
}

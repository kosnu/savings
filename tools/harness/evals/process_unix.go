//go:build darwin || linux

package main

import (
	"errors"
	"fmt"
	"os/exec"
	"syscall"
	"time"
)

func runProcess(cmd *exec.Cmd) error {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.WaitDelay = time.Second
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	err := cmd.Run()
	if cmd.Process != nil {
		cleanup := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		if cleanup == nil {
			return errors.Join(err, fmt.Errorf("残留processを停止したため実行は未完了です"))
		}
		if !errors.Is(cleanup, syscall.ESRCH) {
			return errors.Join(err, cleanup)
		}
	}
	return err
}

//go:build darwin || linux

package core

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"
)

func runProcessGroup(c *exec.Cmd, operation string) error {
	c.WaitDelay = time.Second
	c.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if c.Cancel != nil {
		c.Cancel = func() error {
			// 期限超過時に git や gh と同じグループに属する子も終了する。
			err := syscall.Kill(-c.Process.Pid, syscall.SIGKILL)
			if errors.Is(err, syscall.ESRCH) {
				return os.ErrProcessDone
			}
			return err
		}
	}
	err := c.Run()
	if c.Process == nil {
		return err
	}
	// 出力をredirectした子も含め、専用のprocess groupを後始末する。
	cleanup := syscall.Kill(-c.Process.Pid, syscall.SIGKILL)
	if cleanup == nil {
		return errors.Join(err, fmt.Errorf("%s left residual processes; process group terminated", operation))
	}
	if !errors.Is(cleanup, syscall.ESRCH) {
		return errors.Join(err, fmt.Errorf("%s process cleanup: %w", operation, cleanup))
	}
	return err
}

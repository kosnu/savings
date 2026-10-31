//go:build darwin || linux

package core

import (
	"errors"
	"fmt"
	"os/exec"
	"syscall"
	"time"
)

func runVerification(c *exec.Cmd) error {
	// 親終了後の出力待ちだけを制限する。通常の検証実行時間には上限を設けない。
	c.WaitDelay = time.Second
	c.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	err := c.Run()
	if c.Process == nil {
		return err
	}
	// 出力をredirectした子も含め、この検証専用のprocess groupを後始末する。
	cleanup := syscall.Kill(-c.Process.Pid, syscall.SIGKILL)
	if cleanup == nil {
		return errors.Join(err, fmt.Errorf("verification left residual processes; process group terminated"))
	}
	if !errors.Is(cleanup, syscall.ESRCH) {
		return errors.Join(err, fmt.Errorf("verification process cleanup: %w", cleanup))
	}
	return err
}

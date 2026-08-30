package runner

import (
	"errors"
	"os/exec"
	"time"
)

const verificationProcessWaitDelay = time.Second

func runVerificationCommand(command *exec.Cmd) (runErr error, residualProcess bool, cleanupErr error) {
	configureVerificationProcessGroup(command)
	command.WaitDelay = verificationProcessWaitDelay
	runErr = command.Run()
	residualProcess, cleanupErr = cleanupVerificationProcessGroup(command)
	if errors.Is(runErr, exec.ErrWaitDelay) {
		residualProcess = true
	}
	return runErr, residualProcess, cleanupErr
}

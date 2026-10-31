//go:build !darwin && !linux

package main

import (
	"fmt"
	"os/exec"
)

func runProcess(_ *exec.Cmd) error { return fmt.Errorf("macOS/Linuxの隔離環境が必要です") }

//go:build !darwin && !linux

package repository

import (
	"fmt"
	"os"
	"runtime"
)

func platformFileIdentity(_ os.FileInfo) (uint64, uint64, int64, error) {
	return 0, 0, 0, fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
}

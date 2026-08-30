//go:build darwin

package repository

import (
	"fmt"
	"os"
	"syscall"
)

func platformFileIdentity(info os.FileInfo) (uint64, uint64, int64, error) {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, 0, 0, fmt.Errorf("unexpected stat type %T", info.Sys())
	}
	changeTime := stat.Ctimespec.Sec*1_000_000_000 + stat.Ctimespec.Nsec
	return uint64(stat.Dev), uint64(stat.Ino), changeTime, nil
}

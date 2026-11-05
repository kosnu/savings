package core

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
)

// Snapshotは検査中のメモリ内だけで使い、ファイルに保存しない。
type Entry struct {
	Mode string
	Hash string
}
type Snapshot map[string]Entry
type Checker struct {
	Root string
	Base string
}

// VerificationPlanは実行入力。Taskや操作履歴には保存しない。
type VerificationPlan struct {
	Paths    []string   `json:"paths"`
	Commands [][]string `json:"commands"`
	Rules    []string   `json:"rules"`
}
type Result struct {
	Index int `json:"index"`
	Exit  int `json:"exit"`
}
type Verification struct {
	Results []Result `json:"results"`
	Stable  bool     `json:"stable"`
}
type Ship struct {
	Commit string `json:"commit"`
	Remote string `json:"remote"`
	Branch string `json:"branch"`
	PR     string `json:"pr"`
	Base   string `json:"base"`
}

func digest(v any) string {
	b, _ := json.Marshal(v)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
func required(v ...string) error {
	for _, s := range v {
		if strings.TrimSpace(s) == "" {
			return fmt.Errorf("required value is empty")
		}
	}
	return nil
}
func decode(data []byte, v any) error {
	d := json.NewDecoder(strings.NewReader(string(data)))
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		return e
	}
	var extra any
	if e := d.Decode(&extra); e == io.EOF {
		return nil
	} else if e != nil {
		return e
	}
	return fmt.Errorf("trailing JSON")
}
func ReadInput(path string, v any) error {
	b, e := os.ReadFile(path)
	if e != nil {
		return e
	}
	return decode(b, v)
}

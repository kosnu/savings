package core

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// 工程の最新結果だけを保持する。cycleは起点の設計記録名であり、commitに依存しない。
type PhaseRecord struct {
	Format      string   `json:"format"`
	Cycle       string   `json:"cycle"`
	Kind        string   `json:"kind"`
	Source      string   `json:"source"`
	Paths       []string `json:"paths"`
	Fingerprint string   `json:"fingerprint"`
	PhaseResult
}
type PhaseResult struct {
	Status    string   `json:"status"`
	Checks    []string `json:"checks"`
	Summary   string   `json:"summary"`
	Remaining []string `json:"remaining"`
}

const phaseFormat = "aidd-phase-result-v1"

var recordName = regexp.MustCompile(`^[0-9]{6}\.json$`)
var taskName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$`)

func recordKind(kind string) bool {
	return kind == "design" || kind == "verify" || kind == "review" || kind == "audit"
}

// 記録自身の更新やcommit/rebaseは、対象の内容・modeが同じなら結果を失効させない。
func (s *Checker) recordFingerprint() (string, error) {
	snap, e := s.snapshot("work")
	if e != nil {
		return "", e
	}
	for p := range snap {
		if strings.HasPrefix(p, ".aidd/") {
			delete(snap, p)
		}
	}
	return digest(snap), nil
}

func (s *Checker) phaseRecords(task string) (string, map[string]PhaseRecord, int, string, error) {
	if !taskName.MatchString(task) {
		return "", nil, 0, "", fmt.Errorf("invalid task name")
	}
	dir := filepath.Join(s.Root, ".aidd", "v4", task, "events")
	files, e := filepath.Glob(filepath.Join(dir, "*.json"))
	if e != nil {
		return "", nil, 0, "", e
	}
	sort.Strings(files)
	records := map[string]PhaseRecord{}
	max, latest := 0, ""
	for _, file := range files {
		name := filepath.Base(file)
		if !recordName.MatchString(name) {
			continue
		}
		n, _ := strconv.Atoi(strings.TrimSuffix(name, ".json"))
		if n > max {
			max = n
		}
		data, err := os.ReadFile(file)
		if err != nil {
			return "", nil, 0, "", err
		}
		var header struct {
			Format string `json:"format"`
		}
		// 旧eventは当時の履歴として保持し、現行入力にしない。
		if json.Unmarshal(data, &header) != nil || header.Format != phaseFormat {
			continue
		}
		var r PhaseRecord
		if len(data) > 8192 || decode(data, &r) != nil || !recordKind(r.Kind) || !recordName.MatchString(r.Cycle) {
			return "", nil, 0, "", fmt.Errorf("invalid phase record %s", name)
		}
		records[name] = r
		if r.Kind == "design" {
			if r.Cycle != name {
				return "", nil, 0, "", fmt.Errorf("invalid cycle origin")
			}
			latest = name
		}
	}
	return dir, records, max, latest, nil
}

func savePhase(path string, r PhaseRecord) error {
	b, e := json.MarshalIndent(r, "", "  ")
	if e != nil {
		return e
	}
	if len(b)+1 > 8192 {
		return fmt.Errorf("phase record exceeds 8 KiB")
	}
	if e = os.MkdirAll(filepath.Dir(path), 0755); e != nil {
		return e
	}
	// 同じ工程ファイルを置換し、中断で半端な成功結果を残さない。
	f, e := os.CreateTemp(filepath.Dir(path), ".phase-*")
	if e != nil {
		return e
	}
	defer os.Remove(f.Name())
	if _, e = f.Write(append(b, '\n')); e != nil {
		f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	return os.Rename(f.Name(), path)
}

// BeginPhaseは実行前に古い成功を解除する。新サイクルはcycleなしのdesignだけで開始する。
func (s *Checker) BeginPhase(task, cycle, kind, source string, paths []string) (string, error) {
	if !recordKind(kind) || source == "" || len(source) > 512 || len(paths) == 0 || len(paths) > 32 {
		return "", fmt.Errorf("kind, source and finite paths required; Ship is not recorded")
	}
	for _, p := range paths {
		if !validPath(p) || strings.HasPrefix(p, ".aidd/") || p == ".aidd" {
			return "", fmt.Errorf("invalid target path %s", p)
		}
	}
	dir, records, max, latest, e := s.phaseRecords(task)
	if e != nil {
		return "", e
	}
	name := ""
	if kind == "design" && cycle == "" {
		cycle = fmt.Sprintf("%06d.json", max+1)
	} else if cycle == "" || cycle != latest {
		return "", fmt.Errorf("only the current cycle can be updated")
	}
	for n, r := range records {
		if r.Cycle == cycle && r.Kind == kind {
			if name != "" {
				return "", fmt.Errorf("duplicate phase records")
			}
			name = n
		}
	}
	if name == "" {
		if max >= 999999 {
			return "", fmt.Errorf("record numbering exhausted")
		}
		name = fmt.Sprintf("%06d.json", max+1)
	}
	fp, e := s.recordFingerprint()
	if e != nil {
		return "", e
	}
	r := PhaseRecord{Format: phaseFormat, Cycle: cycle, Kind: kind, Source: source, Paths: paths, Fingerprint: fp,
		PhaseResult: PhaseResult{Status: "running", Checks: []string{}, Remaining: []string{}}}
	path := filepath.Join(dir, name)
	if e = savePhase(path, r); e != nil {
		return "", e
	}
	return filepath.ToSlash(strings.TrimPrefix(path, s.Root+string(filepath.Separator))), nil
}

func validateResult(v PhaseResult) error {
	if v.Status != "pass" && v.Status != "fail" && v.Status != "unknown" {
		return fmt.Errorf("status must be pass, fail or unknown")
	}
	if v.Summary == "" || len(v.Summary) > 1200 || len(v.Checks) == 0 || len(v.Checks) > 32 || len(v.Remaining) > 8 {
		return fmt.Errorf("short summary and finite checks required")
	}
	for _, text := range append(append([]string{}, v.Checks...), v.Remaining...) {
		if text == "" || len(text) > 240 || strings.ContainsAny(text, "\r\n") {
			return fmt.Errorf("checks and remaining items must be short single-line summaries")
		}
	}
	if strings.ContainsAny(v.Summary, "\r\n") || v.Status == "pass" && len(v.Remaining) != 0 {
		return fmt.Errorf("summary must be single-line; pass cannot have remaining work")
	}
	return nil
}

func (s *Checker) phaseFile(path string) (PhaseRecord, string, bool, error) {
	var zero PhaseRecord
	parts := strings.Split(path, "/")
	if len(parts) != 5 || parts[0] != ".aidd" || parts[1] != "v4" || parts[3] != "events" || !recordName.MatchString(parts[4]) {
		return zero, "", false, fmt.Errorf("invalid phase record path")
	}
	dir, records, _, latest, e := s.phaseRecords(parts[2])
	if e != nil {
		return zero, "", false, e
	}
	r, ok := records[parts[4]]
	if !ok {
		return zero, "", false, fmt.Errorf("phase record not found")
	}
	return r, filepath.Join(dir, parts[4]), r.Cycle == latest, nil
}

// FinishPhaseはbegin時点の対象と成功結果を結び付ける。中断はrunningのまま未確認になる。
func (s *Checker) FinishPhase(path string, result PhaseResult) error {
	if e := validateResult(result); e != nil {
		return e
	}
	r, full, active, e := s.phaseFile(path)
	if e != nil {
		return e
	}
	if !active || r.Status != "running" {
		return fmt.Errorf("begin the current cycle phase before completing it")
	}
	fp, e := s.recordFingerprint()
	if e != nil {
		return e
	}
	if result.Status == "pass" && fp != r.Fingerprint {
		result.Status = "unknown"
		result.Summary = "確認中に対象内容またはmodeが変わったため、成功は未確認。"
		r.PhaseResult = result
		if e = savePhase(full, r); e != nil {
			return e
		}
		return fmt.Errorf("phase target changed; result is unknown")
	}
	r.PhaseResult = result
	return savePhase(full, r)
}

// ReadPhaseは保存されたpassだけを根拠にせず、現在の対象・cycleと照合する。書き込まない。
func (s *Checker) ReadPhase(path string) (PhaseRecord, error) {
	r, _, active, e := s.phaseFile(path)
	if e != nil {
		return r, e
	}
	fp, e := s.recordFingerprint()
	if e != nil {
		return r, e
	}
	if !active || r.Status == "running" || fp != r.Fingerprint {
		r.Status = "unknown"
	}
	return r, nil
}

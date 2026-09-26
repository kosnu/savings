package main

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

var taskIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,79}$`)

type counts struct {
	Input  int64 `json:"input_tokens"`
	Output int64 `json:"output_tokens"`
	Total  int64 `json:"total_tokens"`
}

type sample struct {
	Source   string `json:"source"`
	Position int    `json:"position"`
	Counts   counts `json:"counts"`
}

type startRecord struct {
	Kind      string  `json:"kind"`
	ID        string  `json:"id"`
	Session   string  `json:"session"`
	Task      string  `json:"task"`
	Cycle     string  `json:"cycle"`
	Stage     string  `json:"stage"`
	StartedAt string  `json:"started_at"`
	ClockNS   int64   `json:"clock_ns"`
	WallNS    int64   `json:"wall_ns"`
	BootID    *string `json:"boot_id"`
	Usage     *sample `json:"usage"`
}

type finishRecord struct {
	Kind            string   `json:"kind"`
	StartID         string   `json:"start_id"`
	EndedAt         string   `json:"ended_at"`
	DurationSeconds *float64 `json:"duration_seconds"`
	Tokens          *counts  `json:"tokens"`
	TokenNote       string   `json:"token_note"`
}

type reportRow struct {
	Session         string   `json:"session"`
	Task            string   `json:"task"`
	Cycle           string   `json:"cycle"`
	Stage           string   `json:"stage"`
	StartedAt       string   `json:"started_at"`
	EndedAt         string   `json:"ended_at"`
	DurationSeconds *float64 `json:"duration_seconds"`
	Tokens          *counts  `json:"tokens"`
	TokenNote       string   `json:"token_note"`
}

type reportGroup struct {
	Task            string   `json:"task"`
	Cycle           string   `json:"cycle"`
	Sessions        []string `json:"sessions"`
	DurationSeconds *float64 `json:"duration_seconds"`
	TotalTokens     *int64   `json:"total_tokens"`
	Records         int      `json:"records"`
}

type options struct {
	Command, Root, Store, Session, Task, Stage, Cycle, Since, Transcript string
}

type clockReading struct {
	MonoNS int64
	WallNS int64
	BootID *string
}

type dependencies struct {
	Clock func() (clockReading, error)
	Usage func(string, string) (*sample, error)
}

func systemClock() (clockReading, error) {
	var ts unix.Timespec
	if err := unix.ClockGettime(unix.CLOCK_MONOTONIC, &ts); err != nil {
		return clockReading{}, err
	}
	return clockReading{MonoNS: ts.Sec*1_000_000_000 + ts.Nsec, WallNS: time.Now().UnixNano(), BootID: bootID()}, nil
}

func bootID() *string {
	var value string
	if runtime.GOOS == "linux" {
		data, err := os.ReadFile("/proc/sys/kernel/random/boot_id")
		if err != nil {
			return nil
		}
		value = string(data)
	} else if runtime.GOOS == "darwin" {
		data, err := exec.Command("sysctl", "-n", "kern.boottime").Output()
		if err != nil {
			return nil
		}
		value = string(data)
	} else {
		return nil
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func currentCycle(root, task string) (string, error) {
	if !taskIDPattern.MatchString(task) {
		return "", errors.New("Task ID が不正です")
	}
	files, err := filepath.Glob(filepath.Join(root, ".aidd", "v4", task, "events", "*.json"))
	if err != nil || len(files) == 0 {
		return "", fmt.Errorf("Task %s のサイクル記録がありません", task)
	}
	slices.Sort(files)
	data, err := os.ReadFile(files[len(files)-1])
	if err != nil {
		return "", err
	}
	var event struct {
		CycleID string `json:"cycle_id"`
	}
	if err := json.Unmarshal(data, &event); err != nil {
		return "", err
	}
	if !strings.HasPrefix(event.CycleID, task+"/cycle-") {
		return "", fmt.Errorf("Task %s のサイクルIDを取得できません", task)
	}
	return event.CycleID, nil
}

func defaultStore(root string) (string, error) {
	output, err := exec.Command("git", "-C", root, "rev-parse", "--git-common-dir").Output()
	if err != nil {
		return "", err
	}
	common := strings.TrimSpace(string(output))
	if !filepath.IsAbs(common) {
		common = filepath.Join(root, common)
	}
	common, err = filepath.Abs(common)
	if err != nil {
		return "", err
	}
	return filepath.Join(common, "aidd-metrics", "usage.jsonl"), nil
}

func transcriptPath(session, explicit string) string {
	if explicit != "" {
		if info, err := os.Stat(explicit); err == nil && info.Mode().IsRegular() {
			return explicit
		}
		return ""
	}
	home := os.Getenv("CODEX_HOME")
	if home == "" {
		userHome, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		home = filepath.Join(userHome, ".codex")
	}
	var newest string
	var newestTime time.Time
	for _, pattern := range []string{
		filepath.Join(home, "sessions", "*", "*", "*", "*"+session+".jsonl"),
		filepath.Join(home, "archived_sessions", "*"+session+".jsonl"),
	} {
		paths, _ := filepath.Glob(pattern)
		for _, path := range paths {
			info, err := os.Stat(path)
			if err == nil && (newest == "" || info.ModTime().After(newestTime)) {
				newest, newestTime = path, info.ModTime()
			}
		}
	}
	return newest
}

func validCounts(raw json.RawMessage) (counts, bool) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return counts{}, false
	}
	var result counts
	for _, field := range []struct {
		name string
		dest *int64
	}{{"input_tokens", &result.Input}, {"output_tokens", &result.Output}, {"total_tokens", &result.Total}} {
		rawValue, exists := fields[field.name]
		if !exists || bytes.Equal(bytes.TrimSpace(rawValue), []byte("null")) || json.Unmarshal(rawValue, field.dest) != nil || *field.dest < 0 {
			return counts{}, false
		}
	}
	return result, true
}

func usageSample(session, explicit string) (*sample, error) {
	path := transcriptPath(session, explicit)
	if path == "" {
		return nil, nil
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	reader := bufio.NewReader(file)
	var recordSample, countSample *sample
	var seenSession bool
	for position := 1; ; position++ {
		line, readErr := reader.ReadBytes('\n')
		if readErr != nil && readErr != io.EOF {
			return nil, readErr
		}
		if len(line) == 0 {
			break
		}
		var item struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if json.Unmarshal(line, &item) == nil {
			var payload map[string]json.RawMessage
			if json.Unmarshal(item.Payload, &payload) == nil {
				if item.Type == "session_meta" {
					var id string
					if json.Unmarshal(payload["id"], &id) != nil || id != session {
						return nil, nil
					}
					seenSession = true
				}
				var raw json.RawMessage
				var source string
				if item.Type == "token_usage_record" {
					var id string
					if json.Unmarshal(payload["session_id"], &id) == nil && id == session {
						raw, source = payload["thread_token_usage"], "token_usage_record"
					}
				} else if item.Type == "event_msg" {
					var kind string
					if json.Unmarshal(payload["type"], &kind) == nil && kind == "token_count" {
						var info map[string]json.RawMessage
						if json.Unmarshal(payload["info"], &info) == nil {
							raw, source = info["total_token_usage"], "token_count"
						}
					}
				}
				if value, ok := validCounts(raw); ok && source != "" {
					observed := &sample{Source: source, Position: position, Counts: value}
					if source == "token_usage_record" {
						recordSample = observed
					} else {
						countSample = observed
					}
				}
			}
		}
		if readErr == io.EOF {
			break
		}
	}
	if !seenSession {
		return nil, nil
	}
	if recordSample != nil {
		return recordSample, nil
	}
	return countSample, nil
}

func usageDelta(start, end *sample) (*counts, string) {
	if start == nil || end == nil {
		return nil, "トークン使用量の観測値がありません"
	}
	if start.Source != end.Source {
		return nil, "観測値の形式が途中で変わりました"
	}
	if end.Position <= start.Position {
		return nil, "終了時点の新しい観測値がありません"
	}
	delta := counts{end.Counts.Input - start.Counts.Input, end.Counts.Output - start.Counts.Output, end.Counts.Total - start.Counts.Total}
	if delta.Input < 0 || delta.Output < 0 || delta.Total < 0 {
		return nil, "トークン使用量の累積値が減少しました"
	}
	return &delta, "観測済みの使用量"
}

func readEvents(file *os.File, recoverTail bool) ([]json.RawMessage, error) {
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	var events []json.RawMessage
	var offset int64
	for _, line := range bytes.SplitAfter(data, []byte{'\n'}) {
		if len(line) == 0 {
			continue
		}
		complete := line[len(line)-1] == '\n'
		trimmed := bytes.TrimSpace(line)
		if len(trimmed) > 0 {
			if !json.Valid(trimmed) {
				if complete {
					return nil, fmt.Errorf("記録の途中に不正なJSONがあります: %d", offset)
				}
				if recoverTail {
					if err := file.Truncate(offset); err != nil {
						return nil, err
					}
					if err := file.Sync(); err != nil {
						return nil, err
					}
				}
				break
			}
			events = append(events, bytes.Clone(trimmed))
		}
		if !complete && recoverTail {
			if _, err := file.Seek(0, io.SeekEnd); err != nil {
				return nil, err
			}
			if _, err := file.Write([]byte{'\n'}); err != nil {
				return nil, err
			}
			if err := file.Sync(); err != nil {
				return nil, err
			}
		}
		offset += int64(len(line))
	}
	return events, nil
}

func appendEvent(file *os.File, event any) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	if _, err := file.Seek(0, io.SeekEnd); err != nil {
		return err
	}
	if _, err := file.Write(append(data, '\n')); err != nil {
		return err
	}
	return file.Sync()
}

func lockedStore(path string, exclusive bool, action func(*os.File) error) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	file, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer file.Close()
	mode := unix.LOCK_SH
	if exclusive {
		mode = unix.LOCK_EX
	}
	if err := unix.Flock(int(file.Fd()), mode); err != nil {
		return err
	}
	defer unix.Flock(int(file.Fd()), unix.LOCK_UN)
	return action(file)
}

func openStarts(events []json.RawMessage) ([]startRecord, error) {
	finished := map[string]bool{}
	var starts []startRecord
	for _, raw := range events {
		var kind struct {
			Kind string `json:"kind"`
		}
		if err := json.Unmarshal(raw, &kind); err != nil {
			return nil, err
		}
		switch kind.Kind {
		case "start":
			var item startRecord
			if err := json.Unmarshal(raw, &item); err != nil {
				return nil, err
			}
			starts = append(starts, item)
		case "finish":
			var item finishRecord
			if err := json.Unmarshal(raw, &item); err != nil {
				return nil, err
			}
			finished[item.StartID] = true
		}
	}
	var result []startRecord
	for _, item := range starts {
		if !finished[item.ID] {
			result = append(result, item)
		}
	}
	return result, nil
}

func randomID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:]), nil
}

func start(opt options, dep dependencies, out io.Writer) error {
	cycle, err := currentCycle(opt.Root, opt.Task)
	if err != nil {
		return err
	}
	reading, err := dep.Clock()
	if err != nil {
		return err
	}
	usage, err := dep.Usage(opt.Session, opt.Transcript)
	if err != nil {
		return err
	}
	id, err := randomID()
	if err != nil {
		return err
	}
	event := startRecord{"start", id, opt.Session, opt.Task, cycle, opt.Stage, time.Unix(0, reading.WallNS).UTC().Format(time.RFC3339Nano), reading.MonoNS, reading.WallNS, reading.BootID, usage}
	err = lockedStore(opt.Store, true, func(file *os.File) error {
		events, err := readEvents(file, true)
		if err != nil {
			return err
		}
		open, err := openStarts(events)
		if err != nil {
			return err
		}
		for _, item := range open {
			if item.Session == opt.Session {
				return errors.New("このセッションには終了していない工程があります")
			}
		}
		return appendEvent(file, event)
	})
	if err == nil {
		fmt.Fprintf(out, "計測開始: %s / %s / %s / %s\n", opt.Session, opt.Task, cycle, opt.Stage)
	}
	return err
}

func sameBoot(start, end *string) bool {
	return start == nil && end == nil || start != nil && end != nil && *start == *end
}

func finish(opt options, dep dependencies, out io.Writer) error {
	cycle, err := currentCycle(opt.Root, opt.Task)
	if err != nil {
		return err
	}
	return lockedStore(opt.Store, true, func(file *os.File) error {
		events, err := readEvents(file, true)
		if err != nil {
			return err
		}
		open, err := openStarts(events)
		if err != nil {
			return err
		}
		var matches []startRecord
		for _, item := range open {
			if item.Session == opt.Session && item.Task == opt.Task {
				matches = append(matches, item)
			}
		}
		if len(matches) != 1 {
			return errors.New("終了対象の工程が一意に見つかりません")
		}
		started := matches[0]
		if started.Cycle != cycle {
			return errors.New("サイクルが切り替わっています。元のサイクルに属する工程として確認してください")
		}
		reading, err := dep.Clock()
		if err != nil {
			return err
		}
		usage, err := dep.Usage(opt.Session, opt.Transcript)
		if err != nil {
			return err
		}
		tokens, note := usageDelta(started.Usage, usage)
		monoElapsed := reading.MonoNS - started.ClockNS
		wallElapsed := reading.WallNS - started.WallNS
		var duration *float64
		if started.WallNS != 0 && monoElapsed >= 0 && wallElapsed >= 0 && monoElapsed-wallElapsed <= 1_000_000_000 && wallElapsed-monoElapsed <= 1_000_000_000 && sameBoot(started.BootID, reading.BootID) {
			value := float64(monoElapsed) / 1_000_000_000
			value = float64(int64(value*1000+0.5)) / 1000
			duration = &value
		}
		event := finishRecord{"finish", started.ID, time.Unix(0, reading.WallNS).UTC().Format(time.RFC3339Nano), duration, tokens, note}
		if err := appendEvent(file, event); err != nil {
			return err
		}
		shownDuration := "取得不可"
		if duration != nil {
			shownDuration = fmt.Sprintf("%g秒", *duration)
		}
		shownTokens := fmt.Sprintf("取得不可（%s）", note)
		if tokens != nil {
			shownTokens = fmt.Sprintf("観測値 %dトークン", tokens.Total)
		}
		fmt.Fprintf(out, "計測結果: %s / %s / %s / %s: %s, %s\n", opt.Session, opt.Task, cycle, started.Stage, shownDuration, shownTokens)
		return nil
	})
}

func report(opt options, out io.Writer) error {
	var events []json.RawMessage
	if err := lockedStore(opt.Store, false, func(file *os.File) error {
		var err error
		events, err = readEvents(file, false)
		return err
	}); err != nil {
		return err
	}
	starts := map[string]startRecord{}
	for _, raw := range events {
		var kind struct {
			Kind string `json:"kind"`
		}
		if err := json.Unmarshal(raw, &kind); err != nil {
			return err
		}
		if kind.Kind == "start" {
			var item startRecord
			if err := json.Unmarshal(raw, &item); err != nil {
				return err
			}
			starts[item.ID] = item
		}
	}
	rows := []reportRow{}
	for _, raw := range events {
		var kind struct {
			Kind string `json:"kind"`
		}
		if err := json.Unmarshal(raw, &kind); err != nil {
			return err
		}
		if kind.Kind != "finish" {
			continue
		}
		var item finishRecord
		if err := json.Unmarshal(raw, &item); err != nil {
			return err
		}
		started, ok := starts[item.StartID]
		if !ok || opt.Task != "" && opt.Task != started.Task || opt.Cycle != "" && opt.Cycle != started.Cycle || opt.Session != "" && opt.Session != started.Session || opt.Since != "" && started.StartedAt[:min(10, len(started.StartedAt))] < opt.Since {
			continue
		}
		rows = append(rows, reportRow{started.Session, started.Task, started.Cycle, started.Stage, started.StartedAt, item.EndedAt, item.DurationSeconds, item.Tokens, item.TokenNote})
	}
	grouped := map[string][]reportRow{}
	for _, row := range rows {
		grouped[row.Task+"\x00"+row.Cycle] = append(grouped[row.Task+"\x00"+row.Cycle], row)
	}
	keys := make([]string, 0, len(grouped))
	for key := range grouped {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	groups := []reportGroup{}
	for _, key := range keys {
		items := grouped[key]
		group := reportGroup{Task: items[0].Task, Cycle: items[0].Cycle, Records: len(items)}
		sessions := map[string]bool{}
		var seconds float64
		var tokens int64
		durationKnown, tokensKnown := true, true
		for _, item := range items {
			sessions[item.Session] = true
			if item.DurationSeconds == nil {
				durationKnown = false
			} else {
				seconds += *item.DurationSeconds
			}
			if item.Tokens == nil {
				tokensKnown = false
			} else {
				tokens += item.Tokens.Total
			}
		}
		for session := range sessions {
			group.Sessions = append(group.Sessions, session)
		}
		slices.Sort(group.Sessions)
		if durationKnown {
			seconds = float64(int64(seconds*1000+0.5)) / 1000
			group.DurationSeconds = &seconds
		}
		if tokensKnown {
			group.TotalTokens = &tokens
		}
		groups = append(groups, group)
	}
	return json.NewEncoder(out).Encode(struct {
		Records []reportRow   `json:"records"`
		Groups  []reportGroup `json:"groups"`
	}{rows, groups})
}

func run(args []string, out io.Writer, dep dependencies) error {
	if len(args) == 0 {
		return errors.New("command required: start, finish, report")
	}
	f := flag.NewFlagSet(args[0], flag.ContinueOnError)
	f.SetOutput(io.Discard)
	opt := options{Command: args[0]}
	f.StringVar(&opt.Root, "root", ".", "AIDD Taskがあるrepository root")
	f.StringVar(&opt.Store, "store", "", "Git common directory内の記録が既定")
	f.StringVar(&opt.Session, "session", "", "Codex session ID")
	f.StringVar(&opt.Task, "task", "", "AIDD Task ID")
	f.StringVar(&opt.Stage, "stage", "", "工程名")
	f.StringVar(&opt.Cycle, "cycle", "", "reportのサイクル絞り込み")
	f.StringVar(&opt.Since, "since", "", "reportの開始日絞り込み")
	f.StringVar(&opt.Transcript, "transcript", "", "Codex transcriptのpath")
	if err := f.Parse(args[1:]); err != nil {
		return err
	}
	if len(f.Args()) != 0 {
		return errors.New("余分な引数があります")
	}
	if opt.Command != "start" && opt.Command != "finish" && opt.Command != "report" {
		return fmt.Errorf("不明なcommand: %s", opt.Command)
	}
	if opt.Command != "report" {
		if opt.Session == "" {
			opt.Session = os.Getenv("CODEX_SESSION_ID")
		}
		if opt.Session == "" || opt.Task == "" {
			return errors.New("start/finishにはセッションIDとTask IDが必要です")
		}
		if opt.Command == "start" && opt.Stage == "" {
			return errors.New("startには工程名が必要です")
		}
	}
	if opt.Store == "" {
		var err error
		opt.Store, err = defaultStore(opt.Root)
		if err != nil {
			return err
		}
	}
	switch opt.Command {
	case "start":
		return start(opt, dep, out)
	case "finish":
		return finish(opt, dep, out)
	default:
		return report(opt, out)
	}
}

func main() {
	if err := run(os.Args[1:], os.Stdout, dependencies{Clock: systemClock, Usage: usageSample}); err != nil {
		fmt.Fprintln(os.Stderr, "計測エラー:", err)
		os.Exit(1)
	}
}

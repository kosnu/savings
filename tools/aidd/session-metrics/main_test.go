package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type fixture struct {
	t      *testing.T
	root   string
	store  string
	clocks []clockReading
	usage  []*sample
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	root := t.TempDir()
	f := &fixture{t: t, root: root, store: filepath.Join(root, "metrics.jsonl")}
	f.cycle("task-a", "task-a/cycle-0001")
	f.cycle("task-b", "task-b/cycle-0001")
	return f
}

func (f *fixture) cycle(task, cycle string) {
	f.t.Helper()
	dir := filepath.Join(f.root, ".aidd", "v4", task, "events")
	if err := os.MkdirAll(dir, 0755); err != nil {
		f.t.Fatal(err)
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*.json"))
	data, _ := json.Marshal(map[string]string{"cycle_id": cycle})
	if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("%06d.json", len(files)+1)), data, 0644); err != nil {
		f.t.Fatal(err)
	}
}

func (f *fixture) execute(command string, flags ...string) (string, error) {
	f.t.Helper()
	args := append([]string{command, "--root", f.root, "--store", f.store}, flags...)
	var output bytes.Buffer
	dep := dependencies{
		Clock: func() (clockReading, error) {
			if len(f.clocks) == 0 {
				return clockReading{}, fmt.Errorf("clock sample exhausted")
			}
			value := f.clocks[0]
			f.clocks = f.clocks[1:]
			return value, nil
		},
		Usage: func(string, string) (*sample, error) {
			if len(f.usage) == 0 {
				return nil, nil
			}
			value := f.usage[0]
			f.usage = f.usage[1:]
			return value, nil
		},
	}
	err := run(args, &output, dep)
	return output.String(), err
}

func (f *fixture) reading(seconds int64, boot string) {
	f.clocks = append(f.clocks, clockReading{MonoNS: seconds * 1_000_000_000, WallNS: (1000 + seconds) * 1_000_000_000, BootID: &boot})
}

func observed(position int, total int64) *sample {
	return &sample{"token_usage_record", position, counts{total - 2, 2, total}}
}

func mustRun(t *testing.T, f *fixture, command string, flags ...string) string {
	t.Helper()
	result, err := f.execute(command, flags...)
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func reportResult(t *testing.T, f *fixture, flags ...string) struct {
	Records []reportRow   `json:"records"`
	Groups  []reportGroup `json:"groups"`
} {
	t.Helper()
	output := mustRun(t, f, "report", flags...)
	var result struct {
		Records []reportRow   `json:"records"`
		Groups  []reportGroup `json:"groups"`
	}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestRecordsKeepSessionTaskCycleAndStage(t *testing.T) {
	f := newFixture(t)
	for index, item := range []struct{ session, task, stage string }{
		{"session-one", "task-a", "設計"},
		{"session-two", "task-a", "検証"},
		{"session-one", "task-b", "調査"},
	} {
		f.reading(int64(index*10), "boot-a")
		f.reading(int64(index*10+3), "boot-a")
		f.usage = append(f.usage, observed(1, 10), observed(2, 25))
		mustRun(t, f, "start", "--session", item.session, "--task", item.task, "--stage", item.stage)
		if message := mustRun(t, f, "finish", "--session", item.session, "--task", item.task); !strings.Contains(message, "15トークン") {
			t.Fatal(message)
		}
	}
	f.cycle("task-a", "task-a/cycle-0002")
	f.reading(40, "boot-a")
	f.reading(43, "boot-a")
	f.usage = append(f.usage, observed(3, 25), observed(4, 40))
	mustRun(t, f, "start", "--session", "session-one", "--task", "task-a", "--stage", "改善")
	mustRun(t, f, "finish", "--session", "session-one", "--task", "task-a")
	result := reportResult(t, f)
	if len(result.Records) != 4 || len(result.Groups) != 3 {
		t.Fatalf("unexpected report: %+v", result)
	}
	if result.Groups[0].Cycle != "task-a/cycle-0001" || result.Groups[0].TotalTokens == nil || *result.Groups[0].TotalTokens != 30 || strings.Join(result.Groups[0].Sessions, ",") != "session-one,session-two" {
		t.Fatalf("unexpected group: %+v", result.Groups[0])
	}
	filtered := reportResult(t, f, "--session", "session-one", "--task", "task-a")
	if len(filtered.Records) != 2 || filtered.Records[0].Cycle == filtered.Records[1].Cycle {
		t.Fatalf("session/task filtering lost cycle identity: %+v", filtered.Records)
	}
}

func TestMissingOrStaleTokensRemainUnknown(t *testing.T) {
	f := newFixture(t)
	f.reading(1, "boot-a")
	f.reading(4, "boot-a")
	f.usage = []*sample{nil, observed(2, 25)}
	mustRun(t, f, "start", "--session", "one", "--task", "task-a", "--stage", "実装")
	if result := mustRun(t, f, "finish", "--session", "one", "--task", "task-a"); !strings.Contains(result, "取得不可") {
		t.Fatal(result)
	}
	result := reportResult(t, f)
	if result.Records[0].Tokens != nil || result.Groups[0].TotalTokens != nil {
		t.Fatalf("unknown usage became a number: %+v", result)
	}
	if value, _ := usageDelta(observed(2, 25), observed(2, 25)); value != nil {
		t.Fatal("stale usage became a delta")
	}
}

func TestCycleSwitchDoesNotReassignOpenStage(t *testing.T) {
	f := newFixture(t)
	f.reading(1, "boot-a")
	mustRun(t, f, "start", "--session", "one", "--task", "task-a", "--stage", "実装")
	f.cycle("task-a", "task-a/cycle-0002")
	if _, err := f.execute("finish", "--session", "one", "--task", "task-a"); err == nil || !strings.Contains(err.Error(), "サイクルが切り替わって") {
		t.Fatalf("unexpected finish result: %v", err)
	}
}

func TestOnlyOneOpenStagePerSession(t *testing.T) {
	f := newFixture(t)
	f.reading(1, "boot-a")
	f.reading(2, "boot-a")
	mustRun(t, f, "start", "--session", "one", "--task", "task-a", "--stage", "設計")
	if _, err := f.execute("start", "--session", "one", "--task", "task-b", "--stage", "実装"); err == nil || !strings.Contains(err.Error(), "終了していない工程") {
		t.Fatalf("unexpected start result: %v", err)
	}
}

func TestTranscriptIdentityAndLatestLineWithoutOrdinal(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rollout-one.jsonl")
	lines := []string{
		`{"type":"session_meta","payload":{"id":"one"}}`,
		`{"type":"token_usage_record","payload":{"session_id":"another","thread_token_usage":{"input_tokens":98,"output_tokens":2,"total_tokens":100}}}`,
		`{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":10,"output_tokens":2,"total_tokens":12}}}}`,
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0644); err != nil {
		t.Fatal(err)
	}
	start, err := usageSample("one", path)
	if err != nil || start == nil || start.Counts.Total != 12 {
		t.Fatalf("unexpected sample: %+v %v", start, err)
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatal(err)
	}
	_, err = file.WriteString(`{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":21,"output_tokens":2,"total_tokens":23}}}}` + "\n{partial")
	file.Close()
	if err != nil {
		t.Fatal(err)
	}
	end, err := usageSample("one", path)
	if err != nil || end == nil || end.Position != 4 {
		t.Fatalf("latest sample: %+v %v", end, err)
	}
	if delta, _ := usageDelta(start, end); delta == nil || delta.Total != 11 {
		t.Fatalf("unexpected delta: %+v", delta)
	}
	if other, _ := usageSample("two", path); other != nil {
		t.Fatal("another session used this transcript")
	}
}

func TestNullTokenCountIsUnavailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rollout-one.jsonl")
	data := `{"type":"session_meta","payload":{"id":"one"}}` + "\n" +
		`{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":null,"output_tokens":2,"total_tokens":12}}}}` + "\n"
	if err := os.WriteFile(path, []byte(data), 0644); err != nil {
		t.Fatal(err)
	}
	value, err := usageSample("one", path)
	if err != nil || value != nil {
		t.Fatalf("null count accepted: %+v %v", value, err)
	}
}

func TestClockBoundaryMakesDurationUnknown(t *testing.T) {
	for _, test := range []struct {
		name string
		end  clockReading
	}{
		{"boot changed", clockReading{MonoNS: 200_000_000_000, WallNS: 1_200_000_000_000, BootID: ptr("boot-b")}},
		{"clock origin changed", clockReading{MonoNS: 200_000_000_000, WallNS: 1_300_000_000_000, BootID: ptr("boot-a")}},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := newFixture(t)
			f.clocks = []clockReading{{MonoNS: 100_000_000_000, WallNS: 1_100_000_000_000, BootID: ptr("boot-a")}, test.end}
			mustRun(t, f, "start", "--session", "one", "--task", "task-a", "--stage", "実装")
			mustRun(t, f, "finish", "--session", "one", "--task", "task-a")
			if value := reportResult(t, f).Records[0].DurationSeconds; value != nil {
				t.Fatalf("invalid duration: %v", *value)
			}
		})
	}
}

func ptr(value string) *string { return &value }

func TestPartialTailRecoveryAndCompleteCorruption(t *testing.T) {
	f := newFixture(t)
	for _, seconds := range []int64{1, 4, 7, 10} {
		f.reading(seconds, "boot-a")
	}
	mustRun(t, f, "start", "--session", "one", "--task", "task-a", "--stage", "設計")
	mustRun(t, f, "finish", "--session", "one", "--task", "task-a")
	file, err := os.OpenFile(f.store, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatal(err)
	}
	_, err = file.WriteString(`{"kind":"start"`)
	file.Close()
	if err != nil {
		t.Fatal(err)
	}
	if len(reportResult(t, f).Records) != 1 {
		t.Fatal("report lost valid records")
	}
	mustRun(t, f, "start", "--session", "one", "--task", "task-a", "--stage", "検証")
	mustRun(t, f, "finish", "--session", "one", "--task", "task-a")
	if len(reportResult(t, f).Records) != 2 {
		t.Fatal("recovery lost records")
	}
	if err := os.WriteFile(f.store, []byte("not-json\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := f.execute("report"); err == nil {
		t.Fatal("complete corruption was hidden")
	}
}

func TestValidTailWithoutNewlineGetsSeparated(t *testing.T) {
	f := newFixture(t)
	f.reading(1, "boot-a")
	f.reading(4, "boot-a")
	mustRun(t, f, "start", "--session", "one", "--task", "task-a", "--stage", "設計")
	data, err := os.ReadFile(f.store)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(f.store, bytes.TrimSuffix(data, []byte{'\n'}), 0644); err != nil {
		t.Fatal(err)
	}
	mustRun(t, f, "finish", "--session", "one", "--task", "task-a")
	data, _ = os.ReadFile(f.store)
	if len(bytes.Split(bytes.TrimSpace(data), []byte{'\n'})) != 2 || len(reportResult(t, f).Records) != 1 {
		t.Fatal("valid tail and new event were joined")
	}
}

func TestPythonJSONLRecordsRemainReadable(t *testing.T) {
	f := newFixture(t)
	data := `{"kind":"start","id":"legacy-id","session":"one","task":"task-a","cycle":"task-a/cycle-0001","stage":"設計","started_at":"2026-09-26T00:00:00+00:00","clock_ns":100000000000,"wall_ns":1100000000000,"boot_id":"boot-a","usage":null}` + "\n" +
		`{"kind":"finish","start_id":"legacy-id","ended_at":"2026-09-26T00:00:03+00:00","duration_seconds":3.0,"tokens":null,"token_note":"トークン使用量の観測値がありません"}` + "\n"
	if err := os.WriteFile(f.store, []byte(data), 0644); err != nil {
		t.Fatal(err)
	}
	result := reportResult(t, f)
	if len(result.Records) != 1 || result.Records[0].Stage != "設計" || result.Records[0].DurationSeconds == nil || *result.Records[0].DurationSeconds != 3 || result.Groups[0].TotalTokens != nil {
		t.Fatalf("legacy record changed meaning: %+v", result)
	}
}

func TestReportDoesNotFilterBySessionEnvironment(t *testing.T) {
	f := newFixture(t)
	for index, session := range []string{"one", "two"} {
		f.reading(int64(index*10+1), "boot-a")
		f.reading(int64(index*10+4), "boot-a")
		mustRun(t, f, "start", "--session", session, "--task", "task-a", "--stage", "検証")
		mustRun(t, f, "finish", "--session", session, "--task", "task-a")
	}
	t.Setenv("CODEX_SESSION_ID", "one")
	if len(reportResult(t, f).Records) != 2 {
		t.Fatal("report was limited by the session environment")
	}
}

func TestSystemClockReturnsAReading(t *testing.T) {
	reading, err := systemClock()
	if err != nil || reading.MonoNS <= 0 || reading.WallNS <= 0 {
		t.Fatalf("clock unavailable: %+v %v", reading, err)
	}
}

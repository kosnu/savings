package protocol

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

const CompactVersion = 6

func supportedVersion(v int) bool { return v == Version || v == CompactVersion }

// v5のbytesは変更せず、v6だけGitから復元可能な情報を保存対象から除く。
type BaselineMode struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
}

type compactTask struct {
	SchemaVersion int            `json:"schema_version"`
	Kind          string         `json:"kind"`
	Spec          Spec           `json:"spec"`
	BaselineHead  string         `json:"baseline_head"`
	CheckerSHA256 string         `json:"checker_sha256"`
	BaselineModes []BaselineMode `json:"baseline_modes,omitempty"`
}
type legacyTask Task

func (t Task) MarshalJSON() ([]byte, error) {
	if t.SchemaVersion == CompactVersion {
		return canonical.Pretty(compactTask{t.SchemaVersion, t.Kind, t.Spec, t.BaselineHead, t.CheckerSHA256, t.BaselineModes})
	}
	return canonical.Pretty(legacyTask(t))
}
func (t *Task) UnmarshalJSON(b []byte) error {
	var header struct {
		SchemaVersion int `json:"schema_version"`
	}
	if err := json.Unmarshal(b, &header); err != nil {
		return err
	}
	if header.SchemaVersion != CompactVersion {
		var old legacyTask
		if err := canonical.Decode(b, "task", &old); err != nil {
			return err
		}
		*t = Task(old)
		return nil
	}
	var wire compactTask
	if err := canonical.Decode(b, "task", &wire); err != nil {
		return err
	}
	*t = Task{SchemaVersion: wire.SchemaVersion, Kind: wire.Kind, Spec: wire.Spec, BaselineHead: wire.BaselineHead, CheckerSHA256: wire.CheckerSHA256, BaselineModes: wire.BaselineModes}
	return nil
}

func hydrateTask(ctx context.Context, s *repository.Snapshot, t *Task) error {
	if t.SchemaVersion != CompactVersion {
		return nil
	}
	if !commitPattern.MatchString(t.BaselineHead) || !digestPattern.MatchString(t.CheckerSHA256) {
		return fail("BASELINE", t.Spec.ID, "開始commitとchecker identityが必要です")
	}
	var err error
	t.Baseline, err = gitInventory(ctx, s, t.BaselineHead)
	if err != nil {
		return err
	}
	if err := restoreBaselineModes(t); err != nil {
		return err
	}
	for path, target := range map[string]*[]byte{PolicyPath: &t.Policy, rules.DefaultPath: &t.RuleMap, catalog.DefaultPath: &t.Catalog} {
		f, ok := fileMap(t.Baseline)[path]
		if !ok || f.Type != "regular" {
			return fail("BASELINE", path, "開始時のregular file参照がありません")
		}
		*target, err = s.Git(ctx, "show", t.BaselineHead+":"+path)
		if err != nil {
			return err
		}
		if canonical.HashBytes(*target) != f.SHA256 {
			return fail("BASELINE", path, "開始状態の参照が一致しません")
		}
	}
	return nil
}

// rule-mapが開始commitと同じ場合はGit参照、それ以外はTask内で一度だけ保存する。
type RuleMapReference struct {
	SHA256   string `json:"sha256"`
	Snapshot bool   `json:"snapshot,omitempty"`
}
type ruleSnapshot struct {
	SchemaVersion int             `json:"schema_version"`
	Kind          string          `json:"kind"`
	Content       json.RawMessage `json:"content"`
}

func ruleSnapshotPath(id, digest string) string { return taskPath(id, "snapshots/"+digest+".json") }
func saveRuleMap(s *repository.Snapshot, l *Loaded, content []byte) (*RuleMapReference, error) {
	// 元bytesのhashを保持するため、snapshotはJSON stringにbytesをそのまま格納する。
	ref := &RuleMapReference{SHA256: canonical.HashBytes(content)}
	if ref.SHA256 == canonical.HashBytes(l.Task.RuleMap) {
		return ref, nil
	}
	ref.Snapshot = true
	b, err := json.Marshal(string(content))
	if err != nil {
		return nil, err
	}
	record := ruleSnapshot{CompactVersion, "rule_map_snapshot", b}
	path := ruleSnapshotPath(l.Task.Spec.ID, ref.SHA256)
	exists, err := s.Exists(path)
	if err != nil {
		return nil, err
	}
	if exists {
		_, err = readRuleMap(s, l, ref)
	} else {
		_, err = write(s, path, record, true)
	}
	return ref, err
}
func readRuleMap(s *repository.Snapshot, l *Loaded, ref *RuleMapReference) ([]byte, error) {
	if ref == nil || !digestPattern.MatchString(ref.SHA256) {
		return nil, fail("RULE_COVERAGE", l.Task.Spec.ID, "rule-map参照が必要です")
	}
	content := l.Task.RuleMap
	if ref.Snapshot {
		record, _, err := readMode[ruleSnapshot](s, ruleSnapshotPath(l.Task.Spec.ID, ref.SHA256), l.Delivered)
		if err != nil {
			return nil, err
		}
		if record.SchemaVersion != CompactVersion || record.Kind != "rule_map_snapshot" {
			return nil, fail("RULE_COVERAGE", l.Task.Spec.ID, "snapshot形式が不正です")
		}
		var value string
		if err := canonical.Decode(record.Content, "rule_map_snapshot", &value); err != nil {
			return nil, err
		}
		content = []byte(value)
	}
	if canonical.HashBytes(content) != ref.SHA256 {
		return nil, fail("RULE_COVERAGE", l.Task.Spec.ID, "rule-map参照の内容が一致しません")
	}
	return content, nil
}

// ローカル権限とGit転送後のmodeを別digestへ結合し、配列の保存を省く。
type compactEvidence struct {
	SchemaVersion       int             `json:"schema_version"`
	Kind                string          `json:"kind"`
	TaskSHA256          string          `json:"task_sha256"`
	CheckpointSHA256    string          `json:"checkpoint_sha256"`
	RepositorySHA256    string          `json:"repository_sha256"`
	GitRepositorySHA256 string          `json:"git_repository_sha256"`
	ChangedPaths        []string        `json:"changed_paths"`
	Verification        json.RawMessage `json:"verification"`
	CheckerSHA256       string          `json:"checker_sha256"`
}
type legacyEvidence Evidence

func (e Evidence) MarshalJSON() ([]byte, error) {
	if e.SchemaVersion != CompactVersion {
		return canonical.Pretty(legacyEvidence(e))
	}
	return canonical.Pretty(compactEvidence{e.SchemaVersion, e.Kind, e.TaskSHA256, e.CheckpointSHA256, e.RepositorySHA256, e.GitRepositorySHA256, e.ChangedPaths, json.RawMessage(e.Verification), e.CheckerSHA256})
}
func (e *Evidence) UnmarshalJSON(b []byte) error {
	var header struct {
		SchemaVersion int `json:"schema_version"`
	}
	if err := json.Unmarshal(b, &header); err != nil {
		return err
	}
	if header.SchemaVersion != CompactVersion {
		var old legacyEvidence
		if err := canonical.Decode(b, "evidence", &old); err != nil {
			return err
		}
		*e = Evidence(old)
		return nil
	}
	var wire compactEvidence
	if err := canonical.Decode(b, "evidence", &wire); err != nil {
		return err
	}
	var result bytes.Buffer
	if err := json.Indent(&result, wire.Verification, "", "  "); err != nil {
		return err
	}
	result.WriteByte('\n')
	*e = Evidence{SchemaVersion: wire.SchemaVersion, Kind: wire.Kind, TaskSHA256: wire.TaskSHA256, CheckpointSHA256: wire.CheckpointSHA256, RepositorySHA256: wire.RepositorySHA256, GitRepositorySHA256: wire.GitRepositorySHA256, ChangedPaths: wire.ChangedPaths, Verification: result.Bytes(), CheckerSHA256: wire.CheckerSHA256}
	return nil
}

func gitLocalMode(f File) string {
	if f.Type == "symlink" {
		return "0777"
	}
	mode, _ := strconv.ParseUint(f.Mode, 8, 32)
	if mode&0111 != 0 {
		return "0755"
	}
	return "0644"
}
func baselineModes(files []File) []BaselineMode {
	out := []BaselineMode{}
	for _, f := range files {
		if !strings.HasPrefix(f.Path, TaskRoot+"/") && f.Mode != gitLocalMode(f) {
			out = append(out, BaselineMode{f.Path, f.Mode})
		}
	}
	return out
}
func restoreBaselineModes(t *Task) error {
	entries := map[string]int{}
	for i, f := range t.Baseline {
		entries[f.Path] = i
		t.Baseline[i].Mode = gitLocalMode(f)
	}
	previous := ""
	for _, m := range t.BaselineModes {
		i, ok := entries[m.Path]
		mode, err := strconv.ParseUint(m.Mode, 8, 32)
		if !ok || m.Path <= previous || strings.HasPrefix(m.Path, TaskRoot+"/") || err != nil || mode > 0777 || fmt.Sprintf("%04o", mode) != m.Mode || m.Mode == t.Baseline[i].Mode {
			return fail("BASELINE", m.Path, "開始時権限の例外が不正です")
		}
		next := t.Baseline[i]
		next.Mode = m.Mode
		if gitLocalMode(next) != gitLocalMode(t.Baseline[i]) {
			return fail("BASELINE", m.Path, "Git実行権限と開始時権限が一致しません")
		}
		t.Baseline[i] = next
		previous = m.Path
	}
	return nil
}

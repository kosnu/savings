package core

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type Intent struct {
	Source      string   `json:"source"`
	Text        string   `json:"text,omitempty"`
	Objective   string   `json:"objective"`
	Constraints []string `json:"constraints"`
	Acceptance  []string `json:"acceptance"`
	TextHash    string   `json:"text_hash,omitempty"`
}
type Start struct {
	Intent                     Intent `json:"intent"`
	Authority                  string `json:"authority"`
	Baseline                   string `json:"baseline"`
	InitialChangesAcknowledged bool   `json:"initial_changes_acknowledged"`
}
type Entry struct {
	Mode string `json:"mode"`
	Hash string `json:"hash"`
}
type Snapshot map[string]Entry
type Task struct {
	Version int    `json:"version"`
	ID      string `json:"id"`
	Created string `json:"created"`
	Start
	Initial Snapshot `json:"initial"`
}
type Decision struct {
	IntentRevision  *Intent    `json:"intent_revision,omitempty"`
	Summary         string     `json:"summary"`
	Paths           []string   `json:"paths"`
	Commands        [][]string `json:"commands,omitempty"`
	EvidenceVersion int        `json:"evidence_version,omitempty"`
	CommandIDs      []string   `json:"command_ids,omitempty"`
	PlanHash        string     `json:"plan_hash,omitempty"`
	Rules           []string   `json:"rules"`
}
type Criterion struct {
	Criterion string `json:"criterion"`
	Evidence  string `json:"evidence"`
	Verdict   string `json:"verdict"`
}
type Review struct {
	Summary  string      `json:"summary"`
	Criteria []Criterion `json:"criteria"`
	Rules    []string    `json:"rules"`
}
type Result struct {
	Argv         []string `json:"argv,omitempty"`
	Exit         int      `json:"exit"`
	Output       string   `json:"output,omitempty"`
	CommandID    string   `json:"command_id,omitempty"`
	EvidenceHash string   `json:"evidence_hash,omitempty"`
}
type Verification struct {
	EvidenceVersion int      `json:"evidence_version,omitempty"`
	Results         []Result `json:"results"`
	Stable          bool     `json:"stable"`
}
type Ship struct {
	Commit   string `json:"commit"`
	Remote   string `json:"remote"`
	Branch   string `json:"branch"`
	PR       string `json:"pr"`
	Evidence string `json:"evidence"`
	Base     string `json:"base,omitempty"`
}
type Proposal struct {
	ID       string   `json:"id"`
	Finding  string   `json:"finding"`
	Evidence string   `json:"evidence"`
	Change   string   `json:"change"`
	Paths    []string `json:"paths"`
}
type Audit struct {
	Summary             string     `json:"summary"`
	Findings            []string   `json:"findings"`
	SessionImprovements []string   `json:"session_improvements"`
	Proposals           []Proposal `json:"proposals"`
	Delivery            *Ship      `json:"delivery,omitempty"`
}
type Approval struct {
	AuditHash   string   `json:"audit_hash"`
	Source      string   `json:"source"`
	Text        string   `json:"text,omitempty"`
	ProposalIDs []string `json:"proposal_ids"`
	TextHash    string   `json:"text_hash,omitempty"`
}

type Event struct {
	Sequence    int             `json:"sequence"`
	Kind        string          `json:"kind"`
	Time        string          `json:"time"`
	TaskHash    string          `json:"task_hash"`
	Previous    string          `json:"previous"`
	Revision    int             `json:"revision"`
	Fingerprint string          `json:"fingerprint"`
	Data        json.RawMessage `json:"data"`
	Hash        string          `json:"hash"`
	CycleID     string          `json:"cycle_id,omitempty"`
}
type Store struct {
	Root   string
	Task   Task
	Events []Event
}

var taskID = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,79}$`)

// 本文付きの旧記録と、本文を持たない新記録を同じ内容として照合する。
func storedTextHash(text, hash string) (string, error) {
	if text != "" {
		if hash != "" || required(text) != nil {
			return "", fmt.Errorf("invalid stored text")
		}
		return digest(text), nil
	}
	b, err := hex.DecodeString(hash)
	if err != nil || len(b) != sha256.Size || hex.EncodeToString(b) != hash || hash == digest("") {
		return "", fmt.Errorf("invalid stored text hash")
	}
	return hash, nil
}

func (in Intent) withoutText() Intent {
	if in.Text != "" {
		in.TextHash = digest(in.Text)
		in.Text = ""
	}
	return in
}

func (a Approval) validRecord(authority string) bool {
	hash, err := storedTextHash(a.Text, a.TextHash)
	return err == nil && required(a.Source) == nil && hash != digest(authority)
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
	if err := d.Decode(v); err != nil {
		return err
	}
	var extra any
	if err := d.Decode(&extra); err == io.EOF {
		return nil
	} else if err != nil {
		return err
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
func (s *Store) dir() string { return filepath.Join(s.Root, ".aidd/v4", s.Task.ID) }
func (s *Store) revision() int {
	n := 0
	for _, e := range s.Events {
		if e.Kind == "decision" {
			n++
		}
	}
	return n
}
func (s *Store) latest(kind string) *Event {
	for i := len(s.Events) - 1; i >= 0; i-- {
		if s.Events[i].Kind == kind || (kind == "audit" && s.Events[i].Kind == "audit-update") {
			return &s.Events[i]
		}
	}
	return nil
}
func eventData[T any](e *Event) T {
	var v T
	if e != nil {
		json.Unmarshal(e.Data, &v)
	}
	return v
}
func writeNew(path string, v any) error {
	b, e := json.MarshalIndent(v, "", "  ")
	if e != nil {
		return e
	}
	f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if e != nil {
		return e
	}
	_, e = f.Write(append(b, '\n'))
	ce := f.Close()
	if e != nil {
		return e
	}
	return ce
}
func (s *Store) append(kind string, data any, fingerprint string) error {
	b, e := json.Marshal(data)
	if e != nil {
		return e
	}
	if kind == "decision" || kind == "verify" {
		if e := validatePublicData(kind, b, false); e != nil {
			return e
		}
	}
	prev := ""
	if len(s.Events) > 0 {
		prev = s.Events[len(s.Events)-1].Hash
	}
	rev := s.revision()
	if kind == "decision" {
		rev++
	}
	ev := Event{Sequence: len(s.Events) + 1, Kind: kind, Time: time.Now().UTC().Format(time.RFC3339Nano), TaskHash: digest(s.Task), Previous: prev, Revision: rev, Fingerprint: fingerprint, Data: b}
	ev.CycleID = s.cycleID()
	if kind == "start" || kind == "return-intent" {
		ev.CycleID = s.nextCycleID()
	}
	ev.Hash = digest(ev)
	if e := writeNew(filepath.Join(s.dir(), "events", fmt.Sprintf("%06d.json", ev.Sequence)), ev); e != nil {
		return e
	}
	s.Events = append(s.Events, ev)
	return nil
}
func Load(root, id string) (*Store, error) {
	if !taskID.MatchString(id) {
		return nil, fmt.Errorf("invalid task id")
	}
	s := &Store{Root: root}
	b, e := os.ReadFile(filepath.Join(root, ".aidd/v4", id, "task.json"))
	if e != nil {
		return nil, e
	}
	if e = decode(b, &s.Task); e != nil {
		return nil, e
	}
	if s.Task.Version != 4 || s.Task.ID != id {
		return nil, fmt.Errorf("not a v4 task")
	}
	files, e := os.ReadDir(filepath.Join(s.dir(), "events"))
	if e != nil {
		return nil, e
	}
	prev := ""
	rev := 0
	for i, f := range files {
		if f.Name() != fmt.Sprintf("%06d.json", i+1) {
			return nil, fmt.Errorf("event sequence gap or unexpected file")
		}
		var ev Event
		if e = ReadInput(filepath.Join(s.dir(), "events", f.Name()), &ev); e != nil {
			return nil, e
		}
		saved := ev.Hash
		ev.Hash = ""
		if digest(ev) != saved || ev.Previous != prev || ev.TaskHash != digest(s.Task) || ev.Sequence != i+1 {
			return nil, fmt.Errorf("event integrity failure")
		}
		if ev.Kind == "decision" {
			rev++
		}
		if ev.Revision != rev {
			return nil, fmt.Errorf("invalid revision")
		}
		ev.Hash = saved
		s.Events = append(s.Events, ev)
		prev = saved
	}
	if e := s.checkCycleIDs(); e != nil {
		return nil, e
	}
	return s, nil
}

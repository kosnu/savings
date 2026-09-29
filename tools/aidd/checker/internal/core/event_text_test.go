package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func reloadWithoutChat(t *testing.T, s *Store, texts ...string) *Store {
	t.Helper()
	files, err := filepath.Glob(filepath.Join(s.dir(), "events", "*.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(data), `"text":`) {
			t.Fatal("event contains text field", file)
		}
		for _, text := range texts {
			encoded, _ := json.Marshal(text)
			if strings.Contains(string(data), string(encoded)) {
				t.Fatal("event contains chat text", file)
			}
		}
	}
	loaded, err := Load(s.Root, s.Task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := loaded.Check(); err != nil {
		t.Fatal(err)
	}
	return loaded
}

func TestApprovalAndDismissalOmitChatText(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	if err := s.Audit(Audit{Summary: "two proposals", Proposals: []Proposal{
		{"p1", "finding", "evidence", "change", []string{"code.txt"}},
		{"p2", "finding", "evidence", "change", []string{"other.txt"}},
	}}); err != nil {
		t.Fatal(err)
	}
	auditHash := s.latest("audit").Hash
	approval := Approval{AuditHash: auditHash, Source: "user:2", Text: "p1を承認します\n個別のチャット本文", ProposalIDs: []string{"p1"}}
	dismissal := Approval{AuditHash: auditHash, Source: "user:3", Text: "p2は却下します\n別のチャット本文", ProposalIDs: []string{"p2"}}
	if err := s.Approve(approval); err != nil {
		t.Fatal(err)
	}
	s = reloadWithoutChat(t, s, approval.Text)
	if err := s.Dismiss(dismissal); err != nil {
		t.Fatal(err)
	}
	s = reloadWithoutChat(t, s, approval.Text, dismissal.Text)
	for kind, want := range map[string]Approval{"approve": approval, "dismiss": dismissal} {
		got := eventData[Approval](s.latest(kind))
		if got.Text != "" || got.TextHash != digest(want.Text) || got.Source != want.Source || got.AuditHash != auditHash || digest(got.ProposalIDs) != digest(want.ProposalIDs) {
			t.Fatal("lost decision identity", kind)
		}
	}
	if !s.dismissedProposals(auditHash)["p2"] || s.dismissedProposals(auditHash)["p1"] {
		t.Fatal("lost proposal selection")
	}
	put(t, s.Root, "other.txt", "unapproved change\n")
	if s.ImproveCheck() == nil {
		t.Fatal("dismissed scope authorized after reload")
	}
}

func TestIntentRevisionOmitsChatTextAndPreservesMeaning(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	review(t, s)
	intent := s.Task.Intent
	intent.Source, intent.Text = "user:revision", "目的を訂正します\n元のチャット本文"
	intent.Objective = "revised outcome"
	intent.Constraints = []string{"keep existing data"}
	intent.Acceptance = []string{"works better"}
	d, _ := s.decision()
	d.IntentRevision = &intent
	if err := s.Decide(d); err != nil {
		t.Fatal(err)
	}
	if intent.Text == "" || intent.TextHash != "" {
		t.Fatal("input mutated")
	}
	s = reloadWithoutChat(t, s, intent.Text)
	got := s.CurrentIntent()
	if got.Text != "" || got.TextHash != digest(intent.Text) || got.Source != intent.Source || got.Objective != intent.Objective || digest(got.Constraints) != digest(intent.Constraints) || digest(got.Acceptance) != digest(intent.Acceptance) {
		t.Fatal("lost revised Intent")
	}
	if s.Status()["evidence_current"] != false || s.Task.Intent.Text == "" {
		t.Fatal("revision did not invalidate evidence or overwrote initial Intent")
	}
	if err := s.Verify(); err != nil {
		t.Fatal(err)
	}
	if s.Review(Review{Summary: "old criteria", Criteria: []Criterion{{"works", "observed", "pass"}}}) == nil {
		t.Fatal("old acceptance criterion accepted")
	}
	if err := s.Review(Review{Summary: "revised criteria", Criteria: []Criterion{{"works better", "observed", "pass"}}}); err != nil {
		t.Fatal(err)
	}
}

func TestTextHashTransitionDoesNotCountAsIntentImprovement(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	if err := s.Audit(Audit{Summary: "clarify Intent", Proposals: []Proposal{{"p", "finding", "evidence", "clarify", []string{"@intent"}}}}); err != nil {
		t.Fatal(err)
	}
	if err := s.Approve(Approval{AuditHash: s.latest("audit").Hash, Source: "user:2", Text: "approve clarification", ProposalIDs: []string{"p"}}); err != nil {
		t.Fatal(err)
	}
	d, _ := s.decision()
	intent := s.Task.Intent
	intent.Source = "user:3"
	d.IntentRevision = &intent
	if err := s.Decide(d); err != nil {
		t.Fatal(err)
	}
	s = reloadWithoutChat(t, s, intent.Text)
	if s.improvementChanged() == nil {
		t.Fatal("source-only change or text removal counted as improvement")
	}
	intent.Source, intent.Text = "user:4", "changed Intent content"
	if err := s.Decide(d); err != nil {
		t.Fatal(err)
	}
	s = reloadWithoutChat(t, s, intent.Text)
	if err := s.improvementChanged(); err != nil {
		t.Fatal("content change lost", err)
	}
	if err := s.ReturnIntent("confirmed revised Intent"); err != nil {
		t.Fatal(err)
	}
	reloadWithoutChat(t, s, intent.Text)
}

func TestChatInputsStillRequireActualText(t *testing.T) {
	for _, kind := range []string{"approve", "dismiss", "decision"} {
		t.Run(kind, func(t *testing.T) {
			s := fixture(t)
			decide(t, s)
			fakeShip(t, s)
			if err := s.Audit(Audit{Summary: "audit", Proposals: []Proposal{{"p", "finding", "evidence", "change", []string{"@intent"}}}}); err != nil {
				t.Fatal(err)
			}
			if kind == "decision" {
				if err := s.Approve(Approval{AuditHash: s.latest("audit").Hash, Source: "user:2", Text: "approve revision", ProposalIDs: []string{"p"}}); err != nil {
					t.Fatal(err)
				}
			}
			for _, input := range []struct{ text, hash string }{{"", ""}, {" \n", ""}, {"", digest("approval")}, {"approval", digest("approval")}} {
				count := len(s.Events)
				a := Approval{AuditHash: s.latest("audit").Hash, Source: "user:3", Text: input.text, TextHash: input.hash, ProposalIDs: []string{"p"}}
				var err error
				switch kind {
				case "approve":
					err = s.Approve(a)
				case "dismiss":
					err = s.Dismiss(a)
				case "decision":
					d, _ := s.decision()
					intent := s.Task.Intent
					intent.Source, intent.Text, intent.TextHash = a.Source, a.Text, a.TextHash
					d.IntentRevision = &intent
					err = s.Decide(d)
				}
				if err == nil || len(s.Events) != count {
					t.Fatal("invalid input recorded")
				}
			}
		})
	}
}

func TestLegacyChatEventsRemainReadable(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	d, _ := s.decision()
	intent := s.Task.Intent
	intent.Source, intent.Text = "legacy:1", "legacy revision text"
	d.IntentRevision = &intent
	if err := s.append("decision", d, s.latest("decision").Fingerprint); err != nil {
		t.Fatal(err)
	}
	fakeShip(t, s)
	if err := s.Audit(Audit{Summary: "legacy audit", Proposals: []Proposal{{"p1", "finding", "evidence", "change", []string{"code.txt"}}, {"p2", "finding", "evidence", "change", []string{"other.txt"}}}}); err != nil {
		t.Fatal(err)
	}
	audit := s.latest("audit")
	for kind, id := range map[string]string{"approve": "p1", "dismiss": "p2"} {
		// 新入力ではなく、旧版と同じ本文付きJSONを履歴fixtureとして作る。
		data := map[string]any{"audit_hash": audit.Hash, "source": "legacy:2", "text": "legacy decision text", "proposal_ids": []string{id}}
		if err := s.append(kind, data, audit.Fingerprint); err != nil {
			t.Fatal(err)
		}
	}
	loaded, err := Load(s.Root, s.Task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := loaded.Check(); err != nil {
		t.Fatal(err)
	}
	if loaded.CurrentIntent().Text != intent.Text {
		t.Fatal("legacy Intent lost")
	}
	decide(t, loaded)
	if err := loaded.Check(); err != nil {
		t.Fatal("cannot continue legacy Task", err)
	}
}

func TestStoredApprovalTextIdentity(t *testing.T) {
	for _, kind := range []string{"approve", "dismiss"} {
		for _, hash := range []string{"", "invalid", digest(""), digest("implement and ship")} {
			t.Run(kind+"/"+hash, func(t *testing.T) {
				s := fixture(t)
				decide(t, s)
				fakeShip(t, s)
				if err := s.Audit(Audit{Summary: "audit", Proposals: []Proposal{{"p", "finding", "evidence", "change", []string{"code.txt"}}}}); err != nil {
					t.Fatal(err)
				}
				a := s.latest("audit")
				if err := s.append(kind, Approval{AuditHash: a.Hash, Source: "user:2", TextHash: hash, ProposalIDs: []string{"p"}}, a.Fingerprint); err != nil {
					t.Fatal(err)
				}
				loaded, err := Load(s.Root, s.Task.ID)
				if err != nil {
					t.Fatal(err)
				}
				if loaded.Check() == nil {
					t.Fatal("missing, malformed, or original authority hash accepted")
				}
			})
		}
	}
}

package core

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func StartTask(root, id string, in Start) (*Store, error) {
	if !taskID.MatchString(id) {
		return nil, fmt.Errorf("invalid task id")
	}
	if e := required(in.Intent.Source, in.Intent.Text, in.Intent.Objective, in.Authority, in.Baseline); e != nil {
		return nil, e
	}
	if len(in.Intent.Acceptance) == 0 {
		return nil, fmt.Errorf("acceptance criteria required")
	}
	head, e := git(root, "rev-parse", "HEAD")
	if e != nil {
		return nil, e
	}
	if strings.TrimSpace(string(head)) != in.Baseline {
		return nil, fmt.Errorf("baseline must be current HEAD")
	}
	s := &Store{Root: root, Task: Task{Version: 4, ID: id, Created: time.Now().UTC().Format(time.RFC3339Nano), Start: in}}
	now, e := s.snapshot("work")
	if e != nil {
		return nil, e
	}
	base, e := s.snapshot(in.Baseline)
	if e != nil {
		return nil, e
	}
	if len(changed(base, now)) > 0 && !in.InitialChangesAcknowledged {
		return nil, fmt.Errorf("existing changes require explicit acknowledgement")
	}
	s.Task.Initial = now
	if e = os.MkdirAll(filepath.Join(s.dir(), "events"), 0755); e != nil {
		return nil, e
	}
	if e = writeNew(filepath.Join(s.dir(), "task.json"), s.Task); e != nil {
		return nil, e
	}
	if e = s.append("start", map[string]any{"initial_changes": changed(base, now)}, digest(now)); e != nil {
		return nil, e
	}
	return s, nil
}
func (s *Store) decision() (Decision, error) {
	e := s.latest("decision")
	if e == nil {
		return Decision{}, fmt.Errorf("decision required")
	}
	return eventData[Decision](e), nil
}
func (s *Store) workAllowed() error {
	a := s.latest("audit")
	if a != nil {
		ap := s.latest("approve")
		if ap == nil || ap.Sequence < a.Sequence {
			return fmt.Errorf("Audit completed; separate manual approval required before improvements")
		}
		if len(eventData[Approval](ap).ProposalIDs) == 0 {
			return fmt.Errorf("Audit approval without proposals does not authorize changes")
		}
		if e := s.approvalValid(); e != nil {
			return e
		}
	}
	return nil
}
func (s *Store) Decide(d Decision) error {
	if e := s.workAllowed(); e != nil {
		return e
	}
	if d.IntentRevision != nil {
		intent := d.IntentRevision
		old := s.CurrentIntent()
		if required(intent.Source, intent.Text, intent.Objective) != nil || len(intent.Acceptance) == 0 || intent.Source == old.Source {
			return fmt.Errorf("Intent revision requires a new explicit source and complete Intent")
		}
		if s.latest("audit") != nil && !s.intentImprovementApproved() {
			return fmt.Errorf("Intent improvement requires approved @intent proposal")
		}
	}
	if e := required(d.Summary); e != nil {
		return e
	}
	if len(d.Paths) == 0 || len(d.Commands) == 0 {
		return fmt.Errorf("paths and verification commands required")
	}
	for _, p := range d.Paths {
		if !validPath(p) {
			return fmt.Errorf("invalid scope path %q", p)
		}
	}
	for _, c := range d.Commands {
		if len(c) == 0 || required(c...) != nil {
			return fmt.Errorf("empty command")
		}
	}
	now, fp, e := s.current()
	if e != nil {
		return e
	}
	base, e := s.snapshot(s.Task.Baseline)
	if e != nil {
		return e
	}
	if e = s.scope(d.Paths, base, now); e != nil {
		return e
	}
	if e = s.requireCommands(changed(base, now), d); e != nil {
		return e
	}
	rules, e := ResolveRules(s.Root, changed(base, now))
	if e != nil {
		return e
	}
	if e = ensureRules(rules, d.Rules); e != nil {
		return e
	}
	return s.append("decision", d, fp)
}
func (s *Store) constraints() (Snapshot, string, Decision, error) {
	now, fp, e := s.current()
	if e != nil {
		return nil, "", Decision{}, e
	}
	d, e := s.decision()
	if e != nil {
		return nil, "", d, e
	}
	base, e := s.snapshot(s.Task.Baseline)
	if e != nil {
		return nil, "", d, e
	}
	if e = s.scope(d.Paths, base, now); e != nil {
		return nil, "", d, e
	}
	if e = s.requireCommands(changed(base, now), d); e != nil {
		return nil, "", d, e
	}
	rules, e := ResolveRules(s.Root, changed(base, now))
	if e != nil {
		return nil, "", d, e
	}
	if e = ensureRules(rules, d.Rules); e != nil {
		return nil, "", d, e
	}
	if s.latest("approve") != nil {
		if e = s.ImproveCheck(); e != nil {
			return nil, "", d, e
		}
	}
	return now, fp, d, nil
}
func (s *Store) Verify() error {
	if e := s.workAllowed(); e != nil {
		return e
	}
	_, fp, d, e := s.constraints()
	if e != nil {
		return e
	}
	v := Verification{Stable: true}
	failed := false
	for _, argv := range d.Commands {
		c := exec.Command(argv[0], argv[1:]...)
		c.Dir = s.Root
		output, err := runVerification(c)
		exit := 0
		if err != nil {
			exit = -1
			if ex, ok := err.(*exec.ExitError); ok {
				exit = ex.ExitCode()
			}
			output = append(output, []byte("\nverification error: "+err.Error()+"\n")...)
			failed = true
		}
		v.Results = append(v.Results, Result{argv, exit, string(output)})
	}
	_, after, e := s.current()
	if e != nil {
		return e
	}
	v.Stable = after == fp
	if e = s.append("verify", v, fp); e != nil {
		return e
	}
	if failed || !v.Stable {
		return fmt.Errorf("verification failed or changed source; evidence retained")
	}
	return nil
}
func (s *Store) verified(fp string) error {
	v := s.latest("verify")
	if v == nil || v.Revision != s.revision() || v.Fingerprint != fp {
		return fmt.Errorf("verification missing or stale")
	}
	data := eventData[Verification](v)
	d, _ := s.decision()
	if !data.Stable || len(data.Results) != len(d.Commands) {
		return fmt.Errorf("verification incomplete")
	}
	for i, r := range data.Results {
		if r.Exit != 0 || digest(r.Argv) != digest(d.Commands[i]) {
			return fmt.Errorf("verification command failed or changed")
		}
	}
	return nil
}
func (s *Store) Review(r Review) error {
	if e := s.workAllowed(); e != nil {
		return e
	}
	_, fp, d, e := s.constraints()
	if e != nil {
		return e
	}
	if e = s.verified(fp); e != nil {
		return e
	}
	if e = required(r.Summary); e != nil {
		return e
	}
	if len(r.Criteria) < len(s.CurrentIntent().Acceptance) {
		return fmt.Errorf("all Intent acceptance criteria require semantic evidence")
	}
	seen := map[string]bool{}
	for _, c := range r.Criteria {
		if required(c.Criterion, c.Evidence, c.Verdict) != nil {
			return fmt.Errorf("incomplete semantic criterion")
		}
		if c.Verdict != "pass" && c.Verdict != "fail" && c.Verdict != "unknown" {
			return fmt.Errorf("invalid verdict")
		}
		seen[c.Criterion] = true
	}
	for _, a := range s.CurrentIntent().Acceptance {
		if !seen[a] {
			return fmt.Errorf("acceptance criterion absent from review: %s", a)
		}
	}
	for _, id := range d.Rules {
		found := false
		for _, got := range r.Rules {
			found = found || got == id
		}
		if !found {
			return fmt.Errorf("review rule coverage missing: %s", id)
		}
	}
	return s.append("review", r, fp)
}
func (s *Store) ShipCheck() error {
	_, fp, _, e := s.constraints()
	if e != nil {
		return e
	}
	if e = s.workAllowed(); e != nil {
		return e
	}
	if s.latest("audit") != nil {
		approval, decision := s.latest("approve"), s.latest("decision")
		if decision == nil || decision.Sequence <= approval.Sequence || decision.Revision <= approval.Revision {
			return fmt.Errorf("new decision required after improvement approval")
		}
	}
	if e = s.verified(fp); e != nil {
		return e
	}
	r := s.latest("review")
	if r == nil || r.Revision != s.revision() || r.Fingerprint != fp {
		return fmt.Errorf("review missing or stale")
	}
	for _, c := range eventData[Review](r).Criteria {
		if c.Verdict != "pass" {
			return fmt.Errorf("semantic review is not passing")
		}
	}
	recordPath := ".aidd/v4/" + s.Task.ID
	unstaged, err := git(s.Root, "diff", "--name-only", "--", recordPath)
	if err != nil {
		return err
	}
	untracked, err := git(s.Root, "ls-files", "--others", "--exclude-standard", "--", recordPath)
	if err != nil {
		return err
	}
	if len(unstaged) > 0 || len(untracked) > 0 {
		return fmt.Errorf("task records must be staged with verified source")
	}
	index, e := s.snapshot("index")
	if e != nil {
		return e
	}
	if digest(index) != fp {
		return fmt.Errorf("staged content/mode differs from verified worktree")
	}
	return nil
}
func (s *Store) delivery(ship Ship, newShip bool) (string, error) {
	var gate error
	if newShip {
		gate = s.ShipCheck()
	} else {
		gate = s.recordsDeliveryCheck()
	}
	if gate != nil {
		return "", gate
	}
	if e := required(ship.Commit, ship.Remote, ship.Branch, ship.PR, ship.Evidence, ship.Base); e != nil {
		return "", e
	}
	head, e := git(s.Root, "rev-parse", "HEAD")
	if e != nil {
		return "", e
	}
	if strings.TrimSpace(string(head)) != ship.Commit {
		return "", fmt.Errorf("ship commit is not HEAD")
	}
	snap, e := s.snapshot(ship.Commit)
	if e != nil {
		return "", e
	}
	_, fp, e := s.current()
	if e != nil {
		return "", e
	}
	if digest(snap) != fp {
		return "", fmt.Errorf("commit differs from verification")
	}
	remote, e := git(s.Root, "ls-remote", ship.Remote, "refs/heads/"+ship.Branch)
	if e != nil {
		return "", e
	}
	fields := strings.Fields(string(remote))
	if len(fields) != 2 || fields[0] != ship.Commit {
		return "", fmt.Errorf("remote branch does not match ship commit")
	}
	c := exec.Command("gh", "pr", "view", ship.PR, "--json", "headRefOid,headRefName,baseRefName,state")
	c.Dir = s.Root
	b, e := c.Output()
	if e != nil {
		return "", fmt.Errorf("cannot verify PR: %w", e)
	}
	var pr struct {
		HeadRefOid  string
		HeadRefName string
		BaseRefName string
		State       string
	}
	if e = json.Unmarshal(b, &pr); e != nil {
		return "", e
	}
	if pr.HeadRefOid != ship.Commit || pr.HeadRefName != ship.Branch || pr.State != "OPEN" || pr.BaseRefName != ship.Base {
		return "", fmt.Errorf("PR head, base branch or state mismatch")
	}
	return fp, nil
}
func (s *Store) RecordShip(ship Ship) error {
	fp, e := s.delivery(ship, true)
	if e != nil {
		return e
	}
	return s.append("ship", ship, fp)
}
func (s *Store) DeliveryCheck(ship Ship) error { _, e := s.delivery(ship, false); return e }

func (s *Store) Audit(a Audit) error {
	ship := s.latest("ship")
	if ship == nil {
		return fmt.Errorf("Ship required before Audit")
	}
	prior := s.latest("audit")
	kind := "audit"
	if prior != nil && prior.Sequence > ship.Sequence {
		if s.revision() != ship.Revision {
			return fmt.Errorf("new decision requires Ship before Audit update")
		}
		kind = "audit-update"
	}
	_, fp, e := s.current()
	if e != nil {
		return e
	}
	if fp != ship.Fingerprint || s.revision() != ship.Revision {
		return fmt.Errorf("source or decision changed after Ship")
	}
	if prior != nil {
		resolved := s.resolvedProposals(prior.Hash)
		if kind == "audit-update" {
			resolved = s.dismissedProposals(prior.Hash)
		}
		present := map[string]bool{}
		for _, p := range a.Proposals {
			present[p.ID] = true
		}
		for _, p := range eventData[Audit](prior).Proposals {
			if !resolved[p.ID] && !present[p.ID] {
				a.Proposals = append(a.Proposals, p)
			}
		}
	}
	if e = required(a.Summary); e != nil {
		return e
	}
	ids := map[string]bool{}
	for _, p := range a.Proposals {
		if required(p.ID, p.Finding, p.Evidence, p.Change) != nil || len(p.Paths) == 0 || ids[p.ID] {
			return fmt.Errorf("invalid proposal")
		}
		ids[p.ID] = true
		for _, path := range p.Paths {
			if !validPath(path) {
				return fmt.Errorf("invalid proposal path")
			}
		}
	}
	return s.append(kind, a, fp)
}
func (s *Store) Approve(a Approval) error {
	audit := s.latest("audit")
	if audit == nil || a.AuditHash != audit.Hash {
		return fmt.Errorf("approval must bind latest Audit hash")
	}
	if required(a.Source, a.Text) != nil || a.Text == s.Task.Authority {
		return fmt.Errorf("separate explicit manual approval is required")
	}
	if prior := s.latest("approve"); prior != nil && prior.Sequence > audit.Sequence {
		return fmt.Errorf("approval already recorded")
	}
	if len(a.ProposalIDs) == 0 && !s.allProposalsDismissed(audit) {
		return fmt.Errorf("select improvement proposals or explicitly dismiss them before completion")
	}
	data := eventData[Audit](audit)
	ids := map[string]bool{}
	for _, p := range data.Proposals {
		ids[p.ID] = true
	}
	seen := map[string]bool{}
	for _, id := range a.ProposalIDs {
		if !ids[id] || seen[id] || s.dismissedProposals(audit.Hash)[id] {
			return fmt.Errorf("invalid approved proposal")
		}
		seen[id] = true
	}
	_, fp, e := s.current()
	if e != nil {
		return e
	}
	if fp != audit.Fingerprint {
		return fmt.Errorf("changes before approval are forbidden")
	}
	return s.append("approve", a, fp)
}
func (s *Store) approvalValid() error {
	a := s.latest("audit")
	ap := s.latest("approve")
	if a == nil || ap == nil || ap.Sequence < a.Sequence || eventData[Approval](ap).AuditHash != a.Hash {
		return fmt.Errorf("missing or stale approval")
	}
	return nil
}
func (s *Store) ImproveCheck() error {
	if e := s.approvalValid(); e != nil {
		return e
	}
	a := eventData[Audit](s.latest("audit"))
	ap := eventData[Approval](s.latest("approve"))
	ids := map[string]bool{}
	for _, id := range ap.ProposalIDs {
		ids[id] = true
	}
	paths := []string{}
	for _, p := range a.Proposals {
		if ids[p.ID] {
			paths = append(paths, p.Paths...)
		}
	}
	ship := eventData[Ship](s.latest("ship"))
	base, e := s.snapshot(ship.Commit)
	if e != nil {
		return e
	}
	now, _, e := s.current()
	if e != nil {
		return e
	}
	return s.scope(paths, base, now)
}
func (s *Store) Status() map[string]any {
	state := "development"
	ship := s.latest("ship")
	audit := s.latest("audit")
	approval := s.latest("approve")
	if ship != nil {
		state = "shipped"
	}
	if audit != nil {
		state = "approval-pending"
		if approval != nil && approval.Sequence > audit.Sequence {
			state = "improvement-authorized"
			if len(eventData[Approval](approval).ProposalIDs) == 0 && s.allProposalsDismissed(audit) {
				state = "complete"
			}
		}
	}
	_, fp, err := s.current()
	current := err == nil && s.verified(fp) == nil
	if ship != nil && (ship.Fingerprint != fp || ship.Revision != s.revision()) {
		if state == "shipped" {
			state = "development"
		}
		if state == "complete" || state == "approval-pending" {
			state = "unapproved-change"
		}
	}
	var latest any
	if len(s.Events) > 0 {
		e := s.Events[len(s.Events)-1]
		latest = map[string]any{"sequence": e.Sequence, "kind": e.Kind, "hash": e.Hash, "fingerprint": e.Fingerprint}
	}
	return map[string]any{"task": s.Task.ID, "objective": s.CurrentIntent().Objective, "baseline": s.Task.Baseline, "revision": s.revision(), "state": state, "evidence_current": current, "events": len(s.Events), "latest": latest}
}

func (s *Store) recordsDeliveryCheck() error {
	ship := s.latest("ship")
	if ship == nil {
		return fmt.Errorf("record-only delivery requires prior Ship")
	}
	_, fp, e := s.current()
	if e != nil {
		return e
	}
	if fp != ship.Fingerprint {
		return fmt.Errorf("record-only delivery changed verified source")
	}
	index, e := s.snapshot("index")
	if e != nil {
		return e
	}
	if digest(index) != fp {
		return fmt.Errorf("staged source differs")
	}
	p := ".aidd/v4/" + s.Task.ID
	dirty, e := git(s.Root, "diff", "HEAD", "--name-only", "--", p)
	if e != nil {
		return e
	}
	untracked, e := git(s.Root, "ls-files", "--others", "--exclude-standard", "--", p)
	if e != nil {
		return e
	}
	if len(dirty) > 0 || len(untracked) > 0 {
		return fmt.Errorf("records must be committed before delivery check")
	}
	return s.Check()
}

func (s *Store) CurrentIntent() Intent {
	for i := len(s.Events) - 1; i >= 0; i-- {
		if s.Events[i].Kind == "decision" {
			d := eventData[Decision](&s.Events[i])
			if d.IntentRevision != nil {
				return *d.IntentRevision
			}
		}
	}
	return s.Task.Intent
}
func (s *Store) intentImprovementApproved() bool {
	if s.approvalValid() != nil {
		return false
	}
	a := eventData[Audit](s.latest("audit"))
	approval := eventData[Approval](s.latest("approve"))
	for _, p := range a.Proposals {
		for _, id := range approval.ProposalIDs {
			if id == p.ID {
				for _, path := range p.Paths {
					if path == "@intent" {
						return true
					}
				}
			}
		}
	}
	return false
}

func (s *Store) dismissedProposals(hash string) map[string]bool {
	out := map[string]bool{}
	for _, e := range s.Events {
		if e.Kind == "dismiss" {
			a := eventData[Approval](&e)
			if a.AuditHash == hash {
				for _, id := range a.ProposalIDs {
					out[id] = true
				}
			}
		}
	}
	return out
}
func (s *Store) resolvedProposals(hash string) map[string]bool {
	out := s.dismissedProposals(hash)
	decision, ship := s.latest("decision"), s.latest("ship")
	for _, e := range s.Events {
		if e.Kind == "approve" {
			a := eventData[Approval](&e)
			if a.AuditHash == hash && decision != nil && ship != nil &&
				decision.Sequence > e.Sequence && ship.Sequence > decision.Sequence &&
				decision.Revision > e.Revision && ship.Revision == decision.Revision {
				for _, id := range a.ProposalIDs {
					out[id] = true
				}
			}
		}
	}
	return out
}
func (s *Store) allProposalsDismissed(audit *Event) bool {
	dismissed := s.dismissedProposals(audit.Hash)
	for _, p := range eventData[Audit](audit).Proposals {
		if !dismissed[p.ID] {
			return false
		}
	}
	return true
}
func (s *Store) Dismiss(a Approval) error {
	audit := s.latest("audit")
	if audit == nil || a.AuditHash != audit.Hash || required(a.Source, a.Text) != nil || a.Text == s.Task.Authority || len(a.ProposalIDs) == 0 {
		return fmt.Errorf("separate manual dismissal bound to latest Audit required")
	}
	ids := map[string]bool{}
	for _, p := range eventData[Audit](audit).Proposals {
		ids[p.ID] = true
	}
	resolved := s.resolvedProposals(audit.Hash)
	for _, id := range a.ProposalIDs {
		if !ids[id] || resolved[id] {
			return fmt.Errorf("proposal unknown or already decided")
		}
		resolved[id] = true
	}
	_, fp, e := s.current()
	if e != nil {
		return e
	}
	if fp != audit.Fingerprint {
		return fmt.Errorf("dismissal requires unchanged audited source")
	}
	return s.append("dismiss", a, fp)
}

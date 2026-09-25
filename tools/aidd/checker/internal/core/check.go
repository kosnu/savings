package core

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func CheckAll(root string) (int, error) {
	if _, e := ResolveRules(root, nil); e != nil {
		return 0, e
	}
	dirs, e := os.ReadDir(filepath.Join(root, ".aidd/v4"))
	if os.IsNotExist(e) {
		return 0, nil
	}
	if e != nil {
		return 0, e
	}
	count := 0
	for _, d := range dirs {
		if !d.IsDir() {
			return 0, fmt.Errorf("unexpected v4 storage file: %s", d.Name())
		}
		s, e := Load(root, d.Name())
		if e != nil {
			return 0, e
		}
		if e = s.Check(); e != nil {
			return 0, fmt.Errorf("task %s: %w", d.Name(), e)
		}
		count++
	}
	return count, nil
}
func (s *Store) Check() error {
	if len(s.Events) == 0 || s.Events[0].Kind != "start" {
		return fmt.Errorf("start event missing")
	}
	if s.Events[0].Fingerprint != digest(s.Task.Initial) {
		return fmt.Errorf("initial snapshot mismatch")
	}
	if _, e := git(s.Root, "cat-file", "-e", s.Task.Baseline+"^{commit}"); e != nil {
		return e
	}
	var decision, verify, review, ship, audit, approval *Event
	for i := range s.Events {
		e := &s.Events[i]
		switch e.Kind {
		case "start":
			if i != 0 {
				return fmt.Errorf("duplicate start")
			}
		case "decision":
			if audit != nil && (approval == nil || approval.Sequence < audit.Sequence || len(eventData[Approval](approval).ProposalIDs) == 0) {
				return fmt.Errorf("unapproved post-Audit decision")
			}
			decision = e
		case "verify":
			if decision == nil {
				return fmt.Errorf("verification without decision")
			}
			verify = e
		case "review":
			if verify == nil || verify.Revision != e.Revision || verify.Fingerprint != e.Fingerprint {
				return fmt.Errorf("review without current verification")
			}
			v := eventData[Verification](verify)
			if !v.Stable {
				return fmt.Errorf("review follows mutating verification")
			}
			for _, r := range v.Results {
				if r.Exit != 0 {
					return fmt.Errorf("review follows failed verification")
				}
			}
			review = e
		case "ship":
			if review == nil || review.Revision != e.Revision || review.Fingerprint != e.Fingerprint {
				return fmt.Errorf("Ship without current review")
			}
			for _, c := range eventData[Review](review).Criteria {
				if c.Verdict != "pass" {
					return fmt.Errorf("Ship follows failed review")
				}
			}
			ship = e
		case "audit", "audit-update":
			if ship == nil || ship.Fingerprint != e.Fingerprint || ship.Revision != e.Revision || (e.Kind == "audit" && audit != nil && audit.Sequence > ship.Sequence) || (e.Kind == "audit-update" && (audit == nil || audit.Sequence < ship.Sequence || e.Revision != ship.Revision)) {
				return fmt.Errorf("Audit without matching Ship or valid update")
			}
			audit = e
		case "dismiss":
			a := eventData[Approval](e)
			if audit == nil || a.AuditHash != audit.Hash || a.Text == s.Task.Authority || required(a.Text, a.Source) != nil {
				return fmt.Errorf("invalid dismissal")
			}
		case "approve":
			a := eventData[Approval](e)
			if audit == nil || a.AuditHash != audit.Hash || a.Text == s.Task.Authority || required(a.Text, a.Source) != nil {
				return fmt.Errorf("invalid approval")
			}
			approval = e
		default:
			return fmt.Errorf("unknown event kind %s", e.Kind)
		}
	}
	return nil
}

// CheckChangesはPRの実際の差分を、変更されたTaskの最新証拠と照合する。
func CheckChanges(root, baseRef string) error {
	b, e := git(root, "merge-base", "HEAD", baseRef)
	if e != nil {
		return e
	}
	base := strings.TrimSpace(string(b))
	all := &Store{Root: root}
	before, e := all.snapshot(base)
	if e != nil {
		return e
	}
	after, e := all.snapshot("work")
	if e != nil {
		return e
	}
	delta := changed(before, after)
	if len(delta) == 0 {
		return nil
	}
	ids := map[string]bool{}
	for _, p := range delta {
		parts := strings.Split(p, "/")
		if len(parts) >= 4 && parts[0] == ".aidd" && parts[1] == "v4" {
			ids[parts[2]] = true
		}
	}
	if len(ids) == 0 {
		return fmt.Errorf("changed source has no updated v4 Task evidence")
	}
	coveredPaths := map[string]bool{}
	for id := range ids {
		s, e := Load(root, id)
		if e != nil {
			return e
		}
		if e = s.Check(); e != nil {
			return e
		}
		now, fp, e := s.current()
		if e != nil {
			return e
		}
		if e = s.verified(fp); e != nil {
			return fmt.Errorf("task %s: %w", id, e)
		}
		review := s.latest("review")
		if review == nil || review.Fingerprint != fp || review.Revision != s.revision() {
			return fmt.Errorf("task %s review missing or stale", id)
		}
		for _, c := range eventData[Review](review).Criteria {
			if c.Verdict != "pass" {
				return fmt.Errorf("task %s semantic review not passing", id)
			}
		}
		d, e := s.decision()
		if e != nil {
			return e
		}
		initial, e := s.snapshot(s.Task.Baseline)
		if e != nil {
			return e
		}
		if e = s.scope(d.Paths, initial, now); e != nil {
			return e
		}
		paths := changed(initial, now)
		if e = s.requireCommands(paths, d); e != nil {
			return e
		}
		rules, e := ResolveRules(root, paths)
		if e != nil {
			return e
		}
		if e = ensureRules(rules, d.Rules); e != nil {
			return e
		}
		for _, p := range delta {
			if s.own(p) || covered(p, d.Paths) {
				coveredPaths[p] = true
			}
		}
	}
	for _, p := range delta {
		if !coveredPaths[p] {
			return fmt.Errorf("PR change lacks Task ownership: %s", p)
		}
	}
	return nil
}

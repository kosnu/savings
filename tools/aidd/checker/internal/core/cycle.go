package core

import "fmt"

// IntentReturnは改善後にIntentとガードレールを再確認した境界を保存する。
type IntentReturn struct {
	Summary       string `json:"summary"`
	PreviousCycle string `json:"previous_cycle,omitempty"`
	ApprovalHash  string `json:"approval_hash"`
	IntentHash    string `json:"intent_hash"`
}

func (s *Store) cycleID() string {
	if len(s.Events) == 0 {
		return ""
	}
	return s.Events[len(s.Events)-1].CycleID
}

func (s *Store) nextCycleID() string {
	n := 1
	for _, e := range s.Events {
		if e.CycleID != "" && (e.Kind == "start" || e.Kind == "return-intent") {
			n++
		}
	}
	return fmt.Sprintf("%s/cycle-%04d", s.Task.ID, n)
}

func (s *Store) checkCycleIDs() error {
	id, n := "", 0
	for i, e := range s.Events {
		if (i == 0 && e.Kind == "start" && e.CycleID != "") || e.Kind == "return-intent" {
			n++
			id = fmt.Sprintf("%s/cycle-%04d", s.Task.ID, n)
		}
		if e.CycleID != id {
			return fmt.Errorf("invalid cycle identity at event %d", e.Sequence)
		}
	}
	return nil
}

func (s *Store) ReturnIntent(summary string) error {
	if e := required(summary); e != nil {
		return e
	}
	if e := s.workAllowed(); e != nil {
		return e
	}
	a, d := s.latest("approve"), s.latest("decision")
	if a == nil || d == nil || d.Sequence <= a.Sequence || d.Revision <= a.Revision {
		return fmt.Errorf("approved improvement decision required before returning to Intent")
	}
	if r := s.latest("return-intent"); r != nil && r.Sequence > a.Sequence {
		return fmt.Errorf("already returned to Intent for this approval")
	}
	_, fp, _, e := s.constraints()
	if e != nil {
		return e
	}
	return s.append("return-intent", IntentReturn{summary, s.cycleID(), a.Hash, digest(s.CurrentIntent())}, fp)
}

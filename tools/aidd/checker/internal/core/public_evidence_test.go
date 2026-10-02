package core

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPublicVerificationSeparatesPrivateExecution(t *testing.T) {
	for _, exit := range []string{"0", "7"} {
		t.Run(exit, func(t *testing.T) {
			s := fixture(t)
			marker := "/Users/private-owner/work SECRET_TEST_VALUE /private/tmp/private-task"
			d := Decision{Summary: "check private diagnostics", Paths: []string{"code.txt"}, Commands: [][]string{{"git", "diff", "--check"}, {"sh", "-c", "printf '" + marker + "'; printf '" + marker + "' >&2; exit " + exit}}}
			if err := s.Decide(d); err != nil {
				t.Fatal(err)
			}
			if err := s.Verify(); (err == nil) != (exit == "0") {
				t.Fatalf("exit state changed: %v", err)
			}
			for _, e := range s.Events {
				if strings.Contains(string(e.Data), marker) || strings.Contains(string(e.Data), "SECRET_TEST_VALUE") {
					t.Fatal("private content in public event")
				}
			}
			v := eventData[Verification](s.latest("verify"))
			path, err := s.privateEvidencePath(v.Results[1].EvidenceHash)
			if err != nil {
				t.Fatal(err)
			}
			var detail privateResult
			if err := ReadInput(path, &detail); err != nil || !strings.Contains(detail.Output, marker) || len(detail.Argv) != 3 {
				t.Fatalf("private evidence lost: %v", err)
			}
			if stat, err := os.Stat(path); err != nil || stat.Mode().Perm() != 0600 {
				t.Fatalf("private file permissions: %v", err)
			}
			if err := s.CheckPublicRecords(); err != nil {
				t.Fatal(err)
			}
			if strings.Contains(command(t, s.Root, "status", "--porcelain"), "aidd-evidence") {
				t.Fatal("private evidence entered tracked surface")
			}
		})
	}
}

func TestPublicEvidenceRejectsForgedFieldsAndLegacy(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	review(t, s)
	original := append(json.RawMessage(nil), s.latest("verify").Data...)
	for _, field := range []string{"output", "argv", "summary", "unexpected"} {
		t.Run(field, func(t *testing.T) {
			var v map[string]any
			json.Unmarshal(original, &v)
			v["results"].([]any)[0].(map[string]any)[field] = nil
			b, _ := json.Marshal(v)
			if err := validatePublicData("verify", b, false); err == nil {
				t.Fatal("injected field accepted at save boundary")
			}
			// 改変者がhashを整合させても、Ship/CI共通の検査で拒否する。
			ev := s.latest("verify")
			ev.Data, ev.Hash = b, ""
			ev.Hash = digest(*ev)
			if err := s.CheckPublicRecords(); err == nil {
				t.Fatal("injected field accepted at publication boundary")
			}
			ev.Data = original
		})
	}
	var v map[string]any
	json.Unmarshal(original, &v)
	delete(v["results"].([]any)[0].(map[string]any), "exit")
	b, _ := json.Marshal(v)
	if validatePublicData("verify", b, false) == nil {
		t.Fatal("missing exit became success")
	}
	delete(v, "evidence_version")
	b, _ = json.Marshal(v)
	if validatePublicData("verify", b, true) != nil || validatePublicData("verify", b, false) == nil {
		t.Fatal("legacy read and publication were conflated")
	}
	var d map[string]any
	json.Unmarshal(s.latest("decision").Data, &d)
	d["commands"] = []any{[]any{"/private/local-command"}}
	b, _ = json.Marshal(d)
	if validatePublicData("decision", b, false) == nil {
		t.Fatal("execution location accepted in public decision")
	}
}

func TestPublicDecisionRejectsAliasesAndDuplicateKeys(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	original := s.latest("decision").Data
	for _, key := range []string{"commands", "Commands", "COMMANDS", "unexpected", "Plan_Hash"} {
		var d map[string]any
		json.Unmarshal(original, &d)
		d[key] = nil
		b, _ := json.Marshal(d)
		if err := validatePublicData("decision", b, false); err == nil {
			t.Fatalf("public alias accepted: %s", key)
		}
	}
	duplicate := strings.Replace(string(original), `"plan_hash":`, `"plan_hash":"/private/local-detail","plan_hash":`, 1)
	if validatePublicData("decision", []byte(duplicate), false) == nil {
		t.Fatal("duplicate identity hid local detail")
	}
	if err := validatePublicData("decision", original, false); err != nil {
		t.Fatal(err)
	}
}

func TestPublicCommandBindingAndLocalPlanIntegrity(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	if err := s.Verify(); err != nil {
		t.Fatal(err)
	}
	d := eventData[Decision](s.latest("decision"))
	v := eventData[Verification](s.latest("verify"))
	v.Results[0].CommandID = digest("unknown command")
	if validateResultIDs(d, v) == nil {
		t.Fatal("unknown verification identity accepted")
	}
	if err := s.requireCommands([]string{"code.txt"}, d); err != nil {
		t.Fatal(err)
	}
	d.CommandIDs = []string{digest("another command")}
	if s.requireCommands([]string{"code.txt"}, d) == nil {
		t.Fatal("missing mandatory command accepted")
	}
	d = eventData[Decision](s.latest("decision"))
	path, _ := s.privateEvidencePath(d.PlanHash)
	if err := os.WriteFile(path, []byte(`[["true"]]`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := s.executionCommands(d); err == nil {
		t.Fatal("substituted execution plan accepted")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if _, err := s.executionCommands(d); err == nil {
		t.Fatal("missing local plan accepted")
	}
	if err := s.CheckPublicRecords(); err != nil {
		t.Fatal("CI required a private execution plan")
	}
}

func TestStoredApprovalSupportsHashWithoutChangingInput(t *testing.T) {
	for _, raw := range []string{`{"source":"user:2","text":"approved"}`, `{"source":"user:2","text_hash":"` + digest("approved") + `"}`} {
		var a Approval
		if err := decode([]byte(raw), &a); err != nil || !a.validRecord("implement") {
			t.Fatalf("valid approval rejected: %v", err)
		}
	}
	for _, raw := range []string{`{"source":"user:2","text_hash":"bad"}`, `{"source":"user:2","text_hash":"` + digest("") + `"}`, `{"source":"user:2","text":"approved","text_hash":"` + digest("approved") + `"}`} {
		var a Approval
		decode([]byte(raw), &a)
		if a.validRecord("implement") {
			t.Fatal("invalid stored approval accepted")
		}
	}
}

func TestPublicationGatesRejectRehashedInjection(t *testing.T) {
	for _, downgrade := range []bool{false, true} {
		t.Run(fmt.Sprint(downgrade), func(t *testing.T) {
			s := fixture(t)
			decide(t, s)
			review(t, s)
			stage(t, s)
			command(t, s.Root, "commit", "-m", "verified baseline")
			base := command(t, s.Root, "rev-parse", "HEAD")
			event := s.latest("verify")
			var data map[string]any
			json.Unmarshal(event.Data, &data)
			if downgrade {
				delete(data, "evidence_version")
			} else {
				data["results"].([]any)[0].(map[string]any)["output"] = "/Users/private-owner/detail"
			}
			event.Data, _ = json.Marshal(data)
			previous := ""
			for i := range s.Events {
				e := &s.Events[i]
				e.Previous, e.Hash = previous, ""
				e.Hash = digest(*e)
				previous = e.Hash
				b, _ := json.MarshalIndent(e, "", "  ")
				if err := os.WriteFile(filepath.Join(s.dir(), "events", fmt.Sprintf("%06d.json", e.Sequence)), append(b, '\n'), 0644); err != nil {
					t.Fatal(err)
				}
			}
			if s.ShipCheck() == nil {
				t.Fatal("Ship accepted forbidden public record")
			}
			if CheckChanges(s.Root, base) == nil {
				t.Fatal("CI accepted forbidden public record with valid hashes")
			}
		})
	}
}

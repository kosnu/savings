package core

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"time"
)

const shipLookupTimeout = 30 * time.Second

// CheckChangesは実際の差分の規約を解決する。過去の検証やレビューの成功は証明しない。
func CheckChanges(root, baseRef string) error {
	if required(baseRef) != nil {
		return fmt.Errorf("base ref required")
	}
	b, e := git(root, "merge-base", "HEAD", baseRef)
	if e != nil {
		return e
	}
	s := &Checker{Root: root, Base: strings.TrimSpace(string(b))}
	before, e := s.snapshot(s.Base)
	if e != nil {
		return e
	}
	after, e := s.snapshot("work")
	if e != nil {
		return e
	}
	_, e = ResolveRules(root, changed(before, after))
	return e
}

// Verifyは出力を診断用streamへ渡すだけで、結果や履歴に取り込まない。
func (s *Checker) Verify(plan VerificationPlan, diagnostics io.Writer) (Verification, error) {
	result := Verification{Results: []Result{}}
	if required(s.Base) != nil {
		return result, fmt.Errorf("base ref required")
	}
	baseline, e := git(s.Root, "rev-parse", "--verify", "--end-of-options", s.Base+"^{commit}")
	if e != nil {
		return result, e
	}
	if len(plan.Paths) == 0 || len(plan.Commands) == 0 {
		return result, fmt.Errorf("paths and commands required")
	}
	for _, p := range plan.Paths {
		if !validPath(p) {
			return result, fmt.Errorf("invalid scope path %q", p)
		}
	}
	for _, c := range plan.Commands {
		if len(c) == 0 || required(c...) != nil {
			return result, fmt.Errorf("empty command")
		}
	}
	before, fp, e := s.current()
	if e != nil {
		return result, e
	}
	base, e := s.snapshot(strings.TrimSpace(string(baseline)))
	if e != nil {
		return result, e
	}
	if e = s.scope(plan.Paths, base, before); e != nil {
		return result, e
	}
	delta := changed(base, before)
	if e = s.requireCommands(delta, plan); e != nil {
		return result, e
	}
	rules, e := ResolveRules(s.Root, delta)
	if e != nil {
		return result, e
	}
	if e = ensureRules(rules, plan.Rules); e != nil {
		return result, e
	}
	if diagnostics == nil {
		diagnostics = io.Discard
	}
	var failures []error
	for i, args := range plan.Commands {
		c := exec.Command(args[0], args[1:]...)
		c.Dir = s.Root
		c.Stdout = diagnostics
		c.Stderr = diagnostics
		// 親終了後の出力待ちだけを制限する。通常の検証実行時間には上限を設けない。
		err := runProcessGroup(c, "verification")
		exit := 0
		if err != nil {
			exit = -1
			var ee *exec.ExitError
			if errors.As(err, &ee) {
				exit = ee.ExitCode()
			}
			if exit == 0 {
				exit = -1
			}
			failures = append(failures, fmt.Errorf("verification command %d failed (exit %d)", i, exit))
		}
		result.Results = append(result.Results, Result{Index: i, Exit: exit})
	}
	_, after, e := s.current()
	if e != nil {
		return result, errors.Join(append(failures, e)...)
	}
	result.Stable = fp == after
	if !result.Stable {
		failures = append(failures, fmt.Errorf("verification changed worktree content or mode"))
	}
	return result, errors.Join(failures...)
}

// ShipCheckはstageの内容とmodeを検査する。検証・レビューの実施判断はworkflowが担う。
func (s *Checker) ShipCheck() error {
	work, _, e := s.current()
	if e != nil {
		return e
	}
	index, e := s.snapshot("index")
	if e != nil {
		return e
	}
	if digest(work) != digest(index) {
		return fmt.Errorf("staged content/mode differs from worktree")
	}
	_, e = git(s.Root, "diff", "--cached", "--check")
	return e
}

// Shipは配信済みのcommit・remote・PRを照合し、追加ファイルを作らない。
func (s *Checker) Ship(ship Ship) error {
	return s.ship(ship, shipLookupTimeout)
}

func (s *Checker) ship(ship Ship, timeout time.Duration) error {
	if e := required(ship.Commit, ship.Remote, ship.Branch, ship.PR, ship.Base); e != nil {
		return e
	}
	if e := s.ShipCheck(); e != nil {
		return e
	}
	head, e := git(s.Root, "rev-parse", "HEAD")
	if e != nil {
		return e
	}
	if strings.TrimSpace(string(head)) != ship.Commit {
		return fmt.Errorf("ship commit is not HEAD")
	}
	commit, e := s.snapshot(ship.Commit)
	if e != nil {
		return e
	}
	work, _, e := s.current()
	if e != nil {
		return e
	}
	if digest(commit) != digest(work) {
		return fmt.Errorf("commit differs from worktree")
	}
	remote, e := s.shipLookup(timeout, "remote SHA", "git", "ls-remote", ship.Remote, "refs/heads/"+ship.Branch)
	if e != nil {
		return e
	}
	fields := strings.Fields(string(remote))
	if len(fields) != 2 || fields[0] != ship.Commit || fields[1] != "refs/heads/"+ship.Branch {
		return fmt.Errorf("remote branch does not match ship commit")
	}
	b, e := s.shipLookup(timeout, "PR", "gh", "pr", "view", ship.PR, "--json", "headRefOid,headRefName,baseRefName,state")
	if e != nil {
		return e
	}
	var pr struct{ HeadRefOid, HeadRefName, BaseRefName, State string }
	if e = json.Unmarshal(b, &pr); e != nil {
		return e
	}
	if pr.HeadRefOid != ship.Commit || pr.HeadRefName != ship.Branch || pr.BaseRefName != ship.Base || pr.State != "OPEN" {
		return fmt.Errorf("PR head, base branch or state mismatch")
	}
	return nil
}

func (s *Checker) shipLookup(timeout time.Duration, target, name string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	c := exec.CommandContext(ctx, name, args...)
	c.Dir = s.Root
	var output bytes.Buffer
	c.Stdout = &output
	err := runProcessGroup(c, "ship lookup")
	if ctx.Err() != nil {
		return nil, fmt.Errorf("ship verification incomplete: %s lookup timed out after %s: %w", target, timeout, errors.Join(ctx.Err(), err))
	}
	if err != nil {
		return nil, fmt.Errorf("cannot verify %s: %w", target, err)
	}
	return output.Bytes(), nil
}

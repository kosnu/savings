package core

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"path"
	"strings"
	"time"
)

const shipLookupTimeout = 30 * time.Second

// CheckChangesは差分に含まれる文書の配置を検査し、適用規約を解決する。
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
	paths := changed(before, after)
	if e = checkPlacement(paths, after); e != nil {
		return e
	}
	_, e = ResolveRules(root, paths)
	return e
}

func checkPlacement(paths []string, after Snapshot) error {
	for _, p := range paths {
		if _, present := after[p]; present && path.Dir(p) == "docs" && strings.EqualFold(path.Ext(p), ".md") && p != "docs/README.md" && p != "docs/architecture.md" {
			return fmt.Errorf("%s: 文書の責務に合うディレクトリへ配置してください (docs/harness/policies/documentation-policy.md#配置先)", p)
		}
	}
	return nil
}

// VerificationContext は実差分に適用する規約とコマンドを返す。
type VerificationContext struct {
	Base        string       `json:"base"`
	Changed     []string     `json:"changed"`
	Rules       []RuleSource `json:"rules"`
	Commands    [][]string   `json:"commands"`
	fingerprint string
}

type RuleSource struct {
	ID   string `json:"id"`
	File string `json:"file"`
}

func (s *Checker) prepare(paths []string, legacy bool) (VerificationContext, error) {
	var v VerificationContext
	if required(s.Base) != nil || len(paths) == 0 {
		return v, fmt.Errorf("baseline and explicit scope paths required")
	}
	for _, p := range paths {
		if !validPath(p) {
			return v, fmt.Errorf("invalid scope path %q", p)
		}
	}
	baseline, err := git(s.Root, "rev-parse", "--verify", "--end-of-options", s.Base+"^{commit}")
	if err != nil {
		return v, err
	}
	v.Base = strings.TrimSpace(string(baseline))
	base, err := s.snapshot(v.Base)
	if err != nil {
		return v, err
	}
	work, fp, err := s.current()
	if err != nil {
		return v, err
	}
	v.fingerprint = fp
	v.Changed = changed(base, work)
	if err = checkScope(paths, v.Changed, work, legacy); err != nil {
		return v, err
	}
	if !legacy {
		if len(v.Changed) == 0 {
			return v, fmt.Errorf("no changes against baseline")
		}
		if err = checkPlacement(v.Changed, work); err != nil {
			return v, err
		}
	}
	rules, err := ResolveRules(s.Root, v.Changed)
	if err != nil {
		return v, err
	}
	v.Rules = make([]RuleSource, 0, len(rules))
	for _, r := range rules {
		v.Rules = append(v.Rules, RuleSource{ID: r.ID, File: r.File})
	}
	pinned := Checker{Root: s.Root, Base: v.Base}
	v.Commands = pinned.mandatoryCommands(v.Changed)
	if !legacy {
		// stage済み・commit済みの変更も比較元から検査する。
		v.Commands[0] = []string{"git", "diff", "--check", v.Base, "--"}
	}
	return v, nil
}

func (s *Checker) Plan(paths []string) (VerificationContext, error) {
	return s.prepare(paths, false)
}

// VerifyScope は表示済みの計画を信用せず、実行時の差分から再計算する。
func (s *Checker) VerifyScope(paths []string, diagnostics io.Writer) (Verification, error) {
	v, err := s.Plan(paths)
	if err != nil {
		return Verification{}, err
	}
	result, err := s.runChecks(v.Commands, v.fingerprint, diagnostics)
	result.Context = &v
	return result, err
}

// Verify は追加コマンドを指定する既存の計画入力も検査する。
func (s *Checker) Verify(plan VerificationPlan, diagnostics io.Writer) (Verification, error) {
	empty := Verification{Results: []Result{}}
	v, err := s.prepare(plan.Paths, true)
	if err != nil {
		return empty, err
	}
	for _, c := range plan.Commands {
		if len(c) == 0 || required(c...) != nil {
			return empty, fmt.Errorf("empty command")
		}
	}
	if err := requireCommandSet(v.Commands, plan.Commands); err != nil {
		return empty, err
	}
	if err := ensureRules(v.Rules, plan.Rules); err != nil {
		return empty, err
	}
	return s.runChecks(plan.Commands, v.fingerprint, diagnostics)
}

func (s *Checker) runChecks(commands [][]string, fp string, diagnostics io.Writer) (Verification, error) {
	result := Verification{Results: []Result{}}
	if diagnostics == nil {
		diagnostics = io.Discard
	}
	var failures []error
	for i, args := range commands {
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

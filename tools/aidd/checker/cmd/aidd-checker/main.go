package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/core"
	"os"
	"path/filepath"
)

func run() error {
	flags := flag.NewFlagSet("aidd-checker", flag.ContinueOnError)
	root := flags.String("root", ".", "repository root")
	if e := flags.Parse(os.Args[1:]); e != nil {
		return e
	}
	args := flags.Args()
	if len(args) == 0 {
		return fmt.Errorf("command required: rules check-changes verify ship-check ship record-begin record-finish record-read")
	}
	switch args[0] {
	case "rules", "check-changes", "verify", "ship-check", "ship", "record-begin", "record-finish", "record-read":
	default:
		return fmt.Errorf("unsupported command %s; lifecycle recording has been removed", args[0])
	}
	f := flag.NewFlagSet(args[0], flag.ContinueOnError)
	var input, base, paths *string
	var task, cycle, kind, record *string
	switch args[0] {
	case "record-begin":
		task = f.String("task", "", "existing task directory name")
		cycle = f.String("cycle", "", "origin design record filename; omit only for a new design cycle")
		kind = f.String("kind", "", "design verify review audit")
		input = f.String("input", "", "source reference and target paths JSON")
	case "record-finish":
		record = f.String("record", "", "phase record path")
		input = f.String("input", "", "short result JSON; no command output")
	case "record-read":
		record = f.String("record", "", "phase record path")
	case "verify":
		input = f.String("input", "", "verification plan JSON")
		base = f.String("base", "", "verification baseline")
	case "ship":
		input = f.String("input", "", "delivery JSON")
	case "check-changes":
		base = f.String("base", "", "diff base ref")
	case "rules":
		paths = f.String("paths", "", "JSON path array")
	}
	if e := f.Parse(args[1:]); e != nil {
		return e
	}
	if f.NArg() != 0 {
		return fmt.Errorf("unexpected arguments: %v", f.Args())
	}
	abs, e := filepath.Abs(*root)
	if e != nil {
		return e
	}
	checker := &core.Checker{Root: abs}
	encode := func(v any) error { return json.NewEncoder(os.Stdout).Encode(v) }
	switch args[0] {
	case "record-begin":
		var start struct {
			Source string   `json:"source"`
			Paths  []string `json:"paths"`
		}
		if e = core.ReadInput(*input, &start); e != nil {
			return e
		}
		path, err := checker.BeginPhase(*task, *cycle, *kind, start.Source, start.Paths)
		if err != nil {
			return err
		}
		return encode(map[string]string{"record": path})
	case "record-finish":
		var result core.PhaseResult
		if e = core.ReadInput(*input, &result); e != nil {
			return e
		}
		if e = checker.FinishPhase(*record, result); e != nil {
			return e
		}
		return encode(map[string]bool{"record_updated": true})
	case "record-read":
		r, err := checker.ReadPhase(*record)
		if err != nil {
			return err
		}
		return encode(r)
	case "rules":
		var p []string
		if *paths != "" {
			if e = core.ReadInput(*paths, &p); e != nil {
				return e
			}
		}
		r, e := core.ResolveRules(abs, p)
		if e != nil {
			return e
		}
		return encode(r)
	case "check-changes":
		if e = core.CheckChanges(abs, *base); e != nil {
			return e
		}
		return encode(map[string]bool{"changes_checked": true})
	case "verify":
		var plan core.VerificationPlan
		if e = core.ReadInput(*input, &plan); e != nil {
			return e
		}
		checker.Base = *base
		result, err := checker.Verify(plan, os.Stderr)
		if e = encode(result); e != nil {
			return e
		}
		return err
	case "ship-check":
		if e = checker.ShipCheck(); e != nil {
			return e
		}
		return encode(map[string]bool{"stage_checked": true})
	case "ship":
		var ship core.Ship
		if e = core.ReadInput(*input, &ship); e != nil {
			return e
		}
		if e = checker.Ship(ship); e != nil {
			return e
		}
		return encode(map[string]bool{"delivery_checked": true})
	}
	return nil
}
func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, "aidd:", e)
		os.Exit(1)
	}
}

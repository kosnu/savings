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
		return fmt.Errorf("command required: start decision verify review ship-check ship audit approve improve-check return-intent status check check-changes rules")
	}
	f := flag.NewFlagSet(args[0], flag.ContinueOnError)
	id := f.String("task", "", "v4 task id")
	input := f.String("input", "", "JSON input")
	base := f.String("base", "", "PR base ref for candidate evidence checks")
	paths := f.String("paths", "", "JSON path array for rules")
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
	if args[0] == "check-changes" {
		if e = core.CheckChanges(abs, *base); e != nil {
			return e
		}
		return json.NewEncoder(os.Stdout).Encode(map[string]any{"changes_checked": true})
	}
	if args[0] == "rules" {
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
		return json.NewEncoder(os.Stdout).Encode(r)
	}
	if args[0] == "start" {
		var in core.Start
		if e = core.ReadInput(*input, &in); e != nil {
			return e
		}
		s, e := core.StartTask(abs, *id, in)
		if e != nil {
			return e
		}
		return json.NewEncoder(os.Stdout).Encode(s.Status())
	}
	s, e := core.Load(abs, *id)
	if e != nil {
		return e
	}
	var checkedDelivery *core.Ship
	auditCompleted := false
	switch args[0] {
	case "decision":
		var v core.Decision
		if e = core.ReadInput(*input, &v); e == nil {
			e = s.Decide(v)
		}
	case "verify":
		e = s.Verify()
	case "review":
		var v core.Review
		if e = core.ReadInput(*input, &v); e == nil {
			e = s.Review(v)
		}
	case "ship-check":
		e = s.ShipCheck()
	case "ship":
		var v core.Ship
		if e = core.ReadInput(*input, &v); e == nil {
			e = s.Ship(v)
			if e == nil {
				checkedDelivery = &v
			}
		}
	case "delivery-check":
		var v core.Ship
		if e = core.ReadInput(*input, &v); e == nil {
			e = s.DeliveryCheck(v)
		}
	case "audit":
		var v core.Audit
		if e = core.ReadInput(*input, &v); e == nil {
			before := len(s.Events)
			e = s.Audit(v)
			auditCompleted = e == nil && len(s.Events) == before && v.Delivery != nil
		}
	case "approve":
		var v core.Approval
		if e = core.ReadInput(*input, &v); e == nil {
			e = s.Approve(v)
		}
	case "dismiss":
		var v core.Approval
		if e = core.ReadInput(*input, &v); e == nil {
			e = s.Dismiss(v)
		}
	case "improve-check":
		e = s.ImproveCheck()
	case "return-intent":
		var v struct {
			Summary string `json:"summary"`
		}
		if e = core.ReadInput(*input, &v); e == nil {
			e = s.ReturnIntent(v.Summary)
		}
	case "check":
		e = s.Check()
	case "status":
	default:
		return fmt.Errorf("unknown command %s", args[0])
	}
	if e != nil {
		return e
	}
	status := s.Status()
	if checkedDelivery != nil {
		status["state"] = "shipped"
		status["delivery"] = checkedDelivery
	}
	if auditCompleted {
		status["state"] = "audit-complete"
	}
	return json.NewEncoder(os.Stdout).Encode(status)
}
func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, "aidd v4:", e)
		os.Exit(1)
	}
}

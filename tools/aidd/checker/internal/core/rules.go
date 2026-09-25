package core

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type Rule struct {
	ID      string `json:"id"`
	File    string `json:"file"`
	Applies struct {
		Paths []string `json:"paths"`
	} `json:"applies_to"`
	Depends []string `json:"depends_on"`
}
type RuleMap struct {
	Version int    `json:"version"`
	Rules   []Rule `json:"rules"`
	Routing struct {
		Governed []string `json:"governed_paths"`
		Surfaces []struct {
			ID       string   `json:"id"`
			Paths    []string `json:"paths"`
			Required []string `json:"required_rules"`
		} `json:"surfaces"`
	} `json:"review_routing"`
}

func isADRDocument(data []byte) bool {
	lines := strings.Split(strings.TrimPrefix(string(data), "\ufeff"), "\n")
	if strings.TrimSuffix(lines[0], "\r") != "---" {
		return false
	}
	for _, line := range lines[1:] {
		line = strings.TrimSuffix(line, "\r")
		if line == "---" {
			break
		}
		key, raw, ok := strings.Cut(line, ":")
		if !ok || strings.TrimRight(key, " \t") != "doc_type" {
			continue
		}
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if raw[0] == '\'' || raw[0] == '"' {
			value, rest, found := strings.Cut(raw[1:], string(raw[0]))
			if found && value == "adr" && (strings.TrimSpace(rest) == "" || strings.HasPrefix(strings.TrimSpace(rest), "#")) {
				return true
			}
			continue
		}
		fields := strings.Fields(raw)
		if fields[0] == "adr" && (len(fields) == 1 || strings.HasPrefix(fields[1], "#")) {
			return true
		}
	}
	return false
}

func glob(pattern, value string) (bool, error) {
	for _, segment := range strings.Split(pattern, "/") {
		if strings.Contains(segment, "**") && segment != "**" {
			return false, fmt.Errorf("** must occupy an entire path segment: %s", pattern)
		}
	}
	if strings.ContainsAny(pattern, "[]{}\\") {
		return false, fmt.Errorf("unsupported glob %s", pattern)
	}
	var b strings.Builder
	b.WriteByte('^')
	for i := 0; i < len(pattern); i++ {
		switch pattern[i] {
		case '*':
			if i+1 < len(pattern) && pattern[i+1] == '*' {
				i++
				if i+1 < len(pattern) && pattern[i+1] == '/' {
					i++
					b.WriteString("(?:.*/)?")
				} else {
					b.WriteString(".*")
				}
			} else {
				b.WriteString("[^/]*")
			}
		case '?':
			b.WriteString("[^/]")
		default:
			b.WriteString(regexp.QuoteMeta(pattern[i : i+1]))
		}
	}
	b.WriteByte('$')
	re, e := regexp.Compile(b.String())
	if e != nil {
		return false, e
	}
	return re.MatchString(value), nil
}
func matches(patterns []string, path string) (bool, error) {
	yes := false
	for _, p := range patterns {
		m, e := glob(p, path)
		if e != nil {
			return false, e
		}
		yes = yes || m
	}
	return yes, nil
}
func ResolveRules(root string, paths []string) ([]Rule, error) {
	b, e := os.ReadFile(filepath.Join(root, "docs/harness/rule-map.json"))
	if e != nil {
		return nil, e
	}
	var rm RuleMap
	if e = json.Unmarshal(b, &rm); e != nil {
		return nil, e
	}
	if rm.Version != 2 {
		return nil, fmt.Errorf("unsupported rule-map version")
	}
	byID := map[string]Rule{}
	for _, r := range rm.Rules {
		if r.ID == "" || !validPath(r.File) || !strings.HasSuffix(r.File, ".md") {
			return nil, fmt.Errorf("invalid rule")
		}
		data, e := os.ReadFile(filepath.Join(root, r.File))
		if e != nil {
			return nil, e
		}
		if strings.Contains("/"+r.File, "/adr/") || isADRDocument(data) {
			return nil, fmt.Errorf("ADR history cannot be a required rule: %s", r.ID)
		}
		if _, ok := byID[r.ID]; ok {
			return nil, fmt.Errorf("duplicate rule %s", r.ID)
		}
		byID[r.ID] = r
		if _, e = matches(r.Applies.Paths, ""); e != nil {
			return nil, e
		}
	}
	if _, e = matches(rm.Routing.Governed, ""); e != nil {
		return nil, e
	}
	for _, surface := range rm.Routing.Surfaces {
		if _, e = matches(surface.Paths, ""); e != nil {
			return nil, e
		}
		for _, id := range surface.Required {
			if _, ok := byID[id]; !ok {
				return nil, fmt.Errorf("unknown surface rule %s", id)
			}
		}
	}
	selected := map[string]bool{}
	for _, p := range paths {
		governed, e := matches(rm.Routing.Governed, p)
		if e != nil {
			return nil, e
		}
		surface := false
		for _, s := range rm.Routing.Surfaces {
			m, e := matches(s.Paths, p)
			if e != nil {
				return nil, e
			}
			if m {
				surface = true
				for _, id := range s.Required {
					selected[id] = true
				}
			}
		}
		if governed && !surface {
			return nil, fmt.Errorf("governed path has no surface: %s", p)
		}
		for _, r := range rm.Rules {
			m, e := matches(r.Applies.Paths, p)
			if e != nil {
				return nil, e
			}
			if m {
				selected[r.ID] = true
			}
		}
	}
	visiting := map[string]bool{}
	done := map[string]bool{}
	var walk func(string) error
	walk = func(id string) error {
		if visiting[id] {
			return fmt.Errorf("rule dependency cycle: %s", id)
		}
		if done[id] {
			return nil
		}
		r, ok := byID[id]
		if !ok {
			return fmt.Errorf("unknown rule %s", id)
		}
		visiting[id] = true
		for _, dep := range r.Depends {
			if e := walk(dep); e != nil {
				return e
			}
		}
		delete(visiting, id)
		done[id] = true
		return nil
	}
	for id := range byID {
		if e = walk(id); e != nil {
			return nil, e
		}
	}
	for id := range selected {
		if _, ok := byID[id]; !ok {
			return nil, fmt.Errorf("unknown required rule %s", id)
		}
	}
	var include func(string)
	include = func(id string) {
		for _, dep := range byID[id].Depends {
			if !selected[dep] {
				selected[dep] = true
				include(dep)
			}
		}
	}
	for id := range selected {
		include(id)
	}
	out := []Rule{}
	for id := range selected {
		out = append(out, byID[id])
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}
func ensureRules(required []Rule, provided []string) error {
	set := map[string]bool{}
	for _, r := range provided {
		set[r] = true
	}
	for _, r := range required {
		if !set[r.ID] {
			return fmt.Errorf("required rule not acknowledged: %s", r.ID)
		}
	}
	return nil
}

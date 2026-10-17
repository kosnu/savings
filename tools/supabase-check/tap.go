package main

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var tapAssertion = regexp.MustCompile(`^(not )?ok ([0-9]+)(?:\s|$)`)
var tapPlan = regexp.MustCompile(`^1\.\.([0-9]+)$`)

func checkTAP(output string) (int, error) {
	plan, count := -1, 0
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Bail out!") {
			return count, errors.New("pgTAPが中断しました")
		}
		if m := tapPlan.FindStringSubmatch(line); m != nil {
			if plan != -1 {
				return count, errors.New("pgTAP planが重複")
			}
			plan, _ = strconv.Atoi(m[1])
		}
		if m := tapAssertion.FindStringSubmatch(line); m != nil {
			count++
			n, _ := strconv.Atoi(m[2])
			if m[1] != "" || n != count || strings.Contains(strings.ToLower(line), "# skip") || strings.Contains(strings.ToLower(line), "# todo") {
				return count, fmt.Errorf("pgTAP assertion %dが未成功", n)
			}
		}
	}
	if plan <= 0 || plan != count {
		return count, fmt.Errorf("pgTAPの実行不足: plan=%d tests=%d", plan, count)
	}
	return count, nil
}

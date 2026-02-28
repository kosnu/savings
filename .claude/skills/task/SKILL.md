---
name: task
description: Unified task workflow. Auto-detects size (Small/Medium/Large) and runs the appropriate workflow. Use when the user says "/task".
disable-model-invocation: true
argument-hint: "[issue-number or task description]"
---

# Task Workflow

## Step 1: Understand the Task

- If `$ARGUMENTS` is an issue number, run `gh issue view $ARGUMENTS`
- Identify target app(s) (web / api / both) and scope

## Step 2: Size Detection

Detect size and state the reasoning to the user:

1. Changes span both FE and BE → **Large**
2. 4+ files or complex new feature → **Medium**
3. Otherwise → **Small**

**Branch check:** If on main, suggest `/creating-branch`.

Then follow the matching workflow below.

---

## Small (1-3 files, simple fix)

1. **Investigate** — Read target files and related tests directly
2. **Plan & approve** — Present a brief change plan. **Get user approval before implementing.**
3. **Implement** — Apply changes directly (no subagents)
4. **Verify** — Run workspace checks:
   - `apps/web/`: `cd apps/web && task check && task test`
   - `apps/api/`: `deno test --allow-read --allow-env` in the function dir
5. **Done** — Suggest `/committing-changes`

---

## Medium (4-10 files, single app)

1. **Investigate** — Use Task tool (`subagent_type: Explore`) to research related code
2. **Plan & approve** — Create implementation plan (files, order, test strategy). **Get user approval.**
3. **Implement** — Use Task tool (`subagent_type: general-purpose`). Include agent principles from `.claude/agents/fe-engineer.agent.md` or `.claude/agents/be-engineer.agent.md`, specific plan, and coding standards
4. **Review** — Use Task tool (`subagent_type: general-purpose`). Include `.claude/agents/reviewer.agent.md` guidelines. Pass `git diff`. Fix any Critical issues
5. **Verify** — Same as Small
6. **Done** — Suggest `/committing-changes`

---

## Large (10+ files, FE+BE)

1. **Design** — Use Task tool (`subagent_type: Plan`) for full design. **Get user approval.**
2. **API contract** — Define endpoints, request/response types, error formats. **Get user approval.**
3. **Parallel implement** — Launch FE and BE subagents in parallel via Task tool (`subagent_type: general-purpose`, `isolation: "worktree"`). Include respective agent principles
4. **Integrate** — Merge worktree changes, resolve conflicts, verify FE/BE connection points
5. **Review** — Same as Medium but cover both FE and BE diffs
6. **Verify** — Run checks for both workspaces
7. **Done** — Suggest `/committing-changes` and `/creating-draft-pr`

---

## Rules

- Never skip user approval on plans/designs
- No unrelated code improvements
- Give subagents specific instructions (not vague)
- **Dynamic scaling:** If size changes during work — scale up: notify user and restart with larger workflow; scale down: simplify and continue

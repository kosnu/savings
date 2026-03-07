# CLAUDE.md

Claude Code (claude.ai/code) specific guidance. For general project conventions, see `AGENTS.md`.

## Workflow

Use `/task` command for implementation. Claude auto-detects scale (Small / Medium / Large).

| Scale | Criteria | Behavior |
|-------|----------|----------|
| Small | 1-3 files, simple fix | Implement directly |
| Medium | 4-10 files, single app | Use subagents, plan approval required |
| Large | 10+ files, FE+BE cross-cutting | Worktree parallel impl, design + API contract approval required |

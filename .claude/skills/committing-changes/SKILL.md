---
name: committing-changes
description: Stages and commits changes with workspace-specific verification and Japanese commit messages. Use when the user asks to commit, stage changes, or says "コミットして".
disable-model-invocation: true
model: claude-sonnet-4-5
---

# Commit Changes

## Steps

1. Run `git status` and `git diff --stat` to check changes (no full diff — you already know the changes)
2. Run workspace-specific verification:
   - `apps/web/`: `task check` → `task test`
   - `apps/api/`: `deno test --allow-read --allow-env` in the relevant function directory
   - Skip if verification was already run. Do not commit on failure.
3. Stage files individually (`git add -A` only when all changes are confirmed intentional)
4. Split commits by concern (feature, bugfix, refactor, etc.)
5. Run `git diff --staged --stat` to verify staged changes match the task goal
6. Present commit message to user for approval before committing

## Commit Message Format

```
{type}: {message in Japanese}

{description in Japanese}

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`

## Rules

- Do not include unrelated changes
- Always get user approval on the commit message

## Next Action

Suggest `/creating-draft-pr` after commit if appropriate.

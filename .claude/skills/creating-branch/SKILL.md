---
name: creating-branch
description: Creates a feature branch from a GitHub issue number. Use when the user asks to create a branch, start working on an issue, or says "ブランチを切って".
disable-model-invocation: true
model: claude-sonnet-4-5
argument-hint: "[issue-number]"
---

# Create Branch

## Steps

1. Run `gh issue view $ARGUMENTS` to get the issue title and content
2. Generate a short English slug from the issue title (lowercase, hyphen-separated, 2-4 words)
3. Present branch name `issue-{number}/{slug}` to user for confirmation
4. Create the branch from latest main:
   ```bash
   git fetch origin main
   git switch -c issue-{number}/{slug} origin/main
   ```

## Rules

- Always get user confirmation before creating the branch

## Next Action

Suggest `/task $ARGUMENTS` after branch creation.

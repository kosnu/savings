---
name: creating-branch
description: Creates a feature branch from a GitHub issue number. Use when the user asks to create a branch, start working on an issue, or says "ブランチを切って".
disable-model-invocation: true
model: sonnet
argument-hint: "[issue-number]"
---

# Create Branch

## Steps

1. Run `gh issue view $ARGUMENTS` to get the issue title and content
2. Generate a short English slug from the issue title (lowercase, hyphen-separated, 2-4 words)
3. Create the branch from latest main without asking for confirmation:
   ```bash
   git fetch origin main
   git switch -c issue-{number}/{slug} origin/main
   ```

## Next Action

Suggest `/task $ARGUMENTS` after branch creation.

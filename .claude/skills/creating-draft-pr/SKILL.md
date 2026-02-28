---
name: creating-draft-pr
description: Creates a Draft Pull Request using the repository's PR template. Use when the user asks to create a PR, draft PR, or says "PRを作って".
disable-model-invocation: true
model: claude-sonnet-4-5
argument-hint: "[issue-number]"
---

# Create Draft PR

## Steps

1. Identify base branch, head branch, related issue, and change scope
2. Run `git status` to check for uncommitted or out-of-scope changes
3. Read `.github/PULL_REQUEST_TEMPLATE.md` and draft the PR body:
   - Link related issue number
   - Describe changes based on actual diffs
   - Only check off verified items (never mark unverified as done)
   - Add review points in notes section
4. Present PR body to user for approval before creating
5. Create with `gh pr create --draft`
6. Verify title, body, branch, and issue link after creation

## Rules

- Default to Draft (only mark Ready for Review when explicitly requested)
- Keep all template headings intact
- No empty fields or placeholder text
- Always get user approval on the PR body

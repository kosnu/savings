---
name: requirements-goal-builder
description: Build a ready-to-run Codex Goal for the Intent / Requirements phase of AI Driven Development. Use when the user wants to start from a GitHub issue or issue draft and create a Codex Goal that will autonomously produce Requirements / PRD output before design or implementation.
---

# Requirements Goal Builder

## Purpose

Create a Codex Goal text for the Intent / Requirements phase. Do not execute the Goal and do not write the Requirements / PRD itself unless the user separately asks for that.

The output of this skill is a complete Goal body that can be pasted into Codex Goal. The Goal must be self-contained because Codex Goal execution starts immediately and cannot rely on later manual skill calls.

## Inputs

Use the most specific available input:

- GitHub Issue number or URL
- Issue draft text
- User-provided problem statement

If the input is an issue number or URL, inspect the issue before drafting the Goal. Also inspect these repository docs when present:

- `docs/ai-driven-development/workflow.md`
- `docs/ai-driven-development/issue-guidelines.md`
- `docs/ai-driven-development/goal-templates/intent-requirements-goal.md`

## Output

Return only:

1. A concise note if required inputs are missing or ambiguous.
2. A ready-to-run Codex Goal in Markdown.

Do not create a Codex Goal yourself. The user will decide whether to start it.

## Goal Requirements

The generated Goal must include:

- Goal
- Inputs
- Scope
- Autonomy
- Done
- Verification
- Constraints
- Stop
- Suggested output path for the Requirements / PRD

Prefer this output path pattern unless the user specifies another:

```md
docs/ai-driven-development/workspaces/<issue-number-or-topic>/requirements.md
```

## Rules

- Keep the Goal focused on Intent / Requirements only.
- Explicitly say implementation is out of scope for this Goal.
- Treat Issue content as input, not as final requirements.
- Preserve Human on the loop: AI may proceed unless Stop conditions are hit.
- Avoid file names, implementation steps, component choices, schema changes, or test details unless they are stated as constraints in the issue.
- Include Stop conditions for ambiguous success criteria, conflicting existing behavior, scope expansion, new dependencies, DB / API / auth / permission changes, and destructive git operations.
- If the issue lacks enough intent or success criteria, do not invent them. Ask the smallest necessary question or generate a Goal that stops on that ambiguity.

## Template

```md
# Intent / Requirements Goal

## Goal

<issue or topic>を起点に、既存コード・既存ドキュメント・関連Issueを調査し、実装前に参照できるRequirements / PRDを作成する。

## Inputs

- Issue:
- Related docs:
  - docs/ai-driven-development/workflow.md
  - docs/ai-driven-development/issue-guidelines.md
  - docs/ai-driven-development/goal-templates/intent-requirements-goal.md

## Scope

- 対象:
- 対象外:
- 出力先:

## Autonomy

- 既存コード、既存ドキュメント、関連Issueを調査してよい
- Issue内容をそのまま要求として確定せず、目的・制約・成功条件として整理してよい
- 曖昧な点はQ&Aログに残してよい
- Stop条件に当たらない限りRequirements / PRD作成を完了してよい
- 実装、Design Doc作成、PR作成はこのGoalの対象外

## Done

- [ ] 背景と課題が説明されている
- [ ] 対象ユーザーと利用シーンが明確
- [ ] スコープ内 / 外が明確
- [ ] 機能要件が検証可能な形で書かれている
- [ ] 非機能要件・制約が必要に応じて書かれている
- [ ] 受け入れ条件がテスト可能
- [ ] Q&Aログに判断と理由が残っている
- [ ] 技術的考慮事項が参考情報として整理されている
- [ ] Requirements / PRDが指定の出力先に保存されている

## Verification

- 必ず実行:
  - なし
- 手動確認:
  - 必要に応じて監督者が受け入れ条件とStop条件を確認する

## Constraints

- IssueはRequirements / PRDの入力として扱う
- 実装詳細を書きすぎない
- 既存の仕様・ドキュメントと矛盾しない
- ユーザーの未コミット変更を戻さない
- memory更新は行わない

## Stop

- 要件の意図が複数解釈できる
- 対象ユーザーや成功条件が不明
- 既存仕様と矛盾する
- スコープ外の変更が必要そう
- 新規依存、DB変更、API仕様変更、認証・権限変更が必要そう
- 破壊的なgit操作が必要
```

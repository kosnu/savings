# AGENTS.md

Personal savings management app: `apps/web/` is React + TypeScript + Vite;
`apps/api/` is Supabase DB migrations and Auth config.

## Working agreements

- Use Japanese for user communication and inline code comments. Be concise, outcome-first, and evidence-based.
- Answer questions and explanations before acting, and classify intent by meaning rather than punctuation. A question, explanation, read-only investigation, or design proposal alone authorizes no implementation, new Goal, or other unrequested side effect; read-only work explicitly requested or needed to answer is allowed. For a mixed request, answer first, then perform only the explicitly requested work. Continue existing authorized work within its original scope, and do not add confirmation to clear requests.
- For explanations, answer directly without unsolicited plans or remediation proposals.
- For non-trivial changes, state the outcome, scope, constraints, completion criteria, and verification before editing. Use the existing request and approved decisions; do not recreate an approval step for routine choices.
- Continue authorized work through implementation, required verification, review, and in-scope fixes. Ask only when missing intent, a material risk, an unresolved rule conflict, or a change to scope or permissions requires the user's decision. Complete independent authorized work while awaiting that decision.
- Preserve unrelated worktree changes. Keep the smallest practical diff and necessary synchronized representations; stop once the requested outcome and required verification are satisfied.
- Follow the existing pattern in the same layer. Explain a necessary departure before applying it.
- For multi-step work, give a short update before tools and concise updates about findings or decisions. Finish with changes, locations, verification, and any blocker or unverified result.

## Task entrypoints

- Development execution: apply [AIDD v4](docs/ai-driven-development/workflow.md) directly in Claude or Codex. Preserve the Intent source, execution authority, task baseline, and decision revisions. Select implementation steps from the outcome and applicable guardrails.
- After Ship, conduct Audit of findings and the session's development process. Present concrete proposals and obtain explicit manual user approval before guardrail or Intent improvements. Development or Ship authority does not authorize these improvements. Keep approved improvements in the same Task.
- Use the [Go Core](docs/ai-driven-development/aidd-checker-operations.md) for deterministic evidence and boundary checks. Core works without Goals. Codex Goal use follows host tool conditions and the [Codex adapter](docs/ai-driven-development/codex-adapter.md); the parent agent owns any Goal.
- For resumption and review fixes, retrieve the existing Task and latest checkpoint. Preserve established decisions and invalidate evidence through a new revision when decisions change. Ship only content and modes matching verified staged state.
- Git/GitHub operations: [Git Workflow](docs/harness/policies/git-workflow.md). Establish target, diff, authority, and safety before writes; clarify unresolved ambiguity. Commit messages use an English type and Japanese text. Do not wrap commit IDs in backticks in PR comments.

## Context and document routing

Start with the named files and the smallest repository evidence that can answer the task.
Read further when a required fact or decision remains unsupported; avoid searches solely for more examples or wording.

- Use [rule-map.json](docs/harness/rule-map.json) to select current specifications and rules. Apply matching path/surface rules and their `depends_on` closure; use front matter (`area`, `applies_to`, `topics`, `when_to_read`, `status`) for additional targeted discovery. ADRs record decision history and are read when its reasons or changes are needed, not as current rules.
- Read the selected documents when their decision or operation is needed. Do not scan all docs or load every linked reference for each edit. Required routing and review coverage still apply. Use deprecated docs only for deprecated behavior or history.
- Documentation or agent-definition changes: [Documentation Policy](docs/harness/policies/documentation-policy.md). Repository docs live in `docs/`, app docs in `apps/*/docs/`, Web decisions in `apps/web/docs/adr/`.
- Harness structure and rule graph: apply the [Documentation Policy](docs/harness/policies/documentation-policy.md). The [harness ADR](docs/adr/0001-adopt-harness-engineering.md) and [rule graph ADR](docs/adr/0002-adopt-agent-rule-graph.md) preserve the reasons for those decisions.
- Accepted ADR changes: preserve historical text; append a dated Clarification or add a replacement ADR. Run `python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/<base-branch>`.
- State evidence gaps. Use a named low-risk assumption only when it does not change intent, acceptance criteria, or permissions.

## Code Review Rules

- Read [Code Review Policy](docs/harness/policies/code-review.md) for every review. Apply every changed surface's required rules, path matches, and dependencies from the rule map. Do not exclude rules by priority or stop at the first finding.
- Check actual behavior and the final diff against the selected sources; report coverage and unresolved conflicts in the policy's format.

## Command Rules

- When passing extra arguments to pnpm workspace scripts, pass them directly after the script name by default, for example `pnpm --filter web storybook --no-open`.
- Use `--` only after confirming the target script or underlying CLI requires it.

## Subagent Usage

- 原則としてメインエージェントが調査・実装・レビューを行う。軽微な修正、定型的な確認、テストやGit検証の実行・結果確認、局所的な再利用確認はメインで完結させる。
- サブエージェントは、複雑で独立した作業の分担や重大なリスクの独立検証など、追加のトークン・引継ぎ・統合コストに見合う具体的な効果がある場合に限定する。ファイル数、レビュー観点の数、並列化できること、低コストモデルであることだけを起動理由にしない。
- 委譲前に、担当させる独立した問題と、メインで処理するより追加コストに見合う理由を短く示す。条件を満たす利用にユーザーの明示依頼は必須ではない。必要最小限の数と有限の担当範囲に限定し、同じ調査・レビューの重複委譲や、修正のたびの定型的な再レビュー委譲をしない。

## Mandatory Web Component Structure Rules

- Before adding, moving, or extracting Web components, read and follow `apps/web/docs/policies/component-structure.md`.
- If a requested change or review comment conflicts with that policy, stop and clarify before editing.

## Verification

Run the affected app's verification commands from the repository root
when the change includes application code,
or any changes to build/type configuration or DB migrations
that can affect runtime behavior, build output, or type safety.

Documentation-only and non-runtime skill changes do not require app verification.
Run any document, skill, or Core checks required by their applicable contract.

- Define verification as the concrete commands for each app, not a `verify` wrapper task.
- If the current diff is exactly identical to the diff for the most recent run of the same verification commands, you may skip rerunning them.
- Run the listed independent verification commands in parallel when practical.
- Do not start multiple instances of the same verification command at the same time.
- When running verification commands in parallel, if one command fails before the others finish,
  wait for all already-started verification commands to finish before making fixes or rerunning checks.
- After fixing a failure, start any required reruns as a new verification batch only after the previous batch has fully completed.
- Fix failures caused by the requested change and rerun required checks within the authorized scope. Report unrelated failures and their impact; do not broaden the task to repair them.

- **Web** (`apps/web/`)
  Before starting the verification batch for application code changes, run:
  `pnpm run web:format`

  Run these commands in the same verification batch:
  `pnpm run web:lint`
  `pnpm run web:format-check`
  `pnpm run web:typecheck`
  `pnpm run web:test:unit-integration`

  Run `pnpm run web:test:storybook` only when the change affects `browser-test` tagged stories, `apps/web/.storybook-test/`, or Storybook browser-test configuration.

- **API** (`apps/api`)
  No dedicated verification commands are currently defined. If verification commands are added later, define the concrete commands here.

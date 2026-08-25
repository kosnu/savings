---
title: Intent / Requirements Goal Template
doc_type: template
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - requirements
  - prd
when_to_read:
  - Requirements Goalを構築するとき
---

# Intent / Requirements Goal

このGoalは要求成果物だけを所有し、実装しません。

## Goalへ含める情報

- 目的: 最新Issue本文全体を、安定IDを持つ検証可能なRequirementsへ変換する。
- Cycle identity: Issue ID、URL、`updatedAt`、本文SHA-256、workspaceと、Requirementsだけが`validation.cycle_start_issue_title`として所有する取得済みtitle。
- Task Context: 保存した最新Issue本文だけ。
- Rule selection: Issue本文にliteral evidenceがあるpath、domain、activity、topicに該当するdirect nodeと、宣言済み`depends_on` closure。
- Baseline: validatorがGit `HEAD`のcanonical `requirements.json`から取得したinventoryとhash。
- Scope: baselineと現在の全requirement、必須section、そのtransition status。
- 所有する出力: canonical `requirements.json`と生成`requirements.md`。
- 読み取り専用: 前回成果物と実装コード。前回成果物はcontinuity確認にのみ使う。

## 必須contract ID

- constraints: `task-context`, `phase-boundary`
- stop: `validation-failure`, `scope-ambiguity`
- done: `complete-scope`, `validated-artifact`

[workflow](../workflow.md)の順序とcanonical textをそのまま使い、task固有entryだけを後ろへ追加します。

## Done / Verification

- 全current requirement IDに定義があり、全baseline IDが維持・変更・明示retireのいずれかで説明されている。
- 必須sectionのinventoryとtransitionが完全である。
- Issue provenance、literal rule selection、rule dependency、continuity、canonical path、render同期のgateが成功する。
- 完了直前にIssue snapshotが変わっていない。

## Stop

- Issue、workspace、要求scope、Issue evidenceに基づくrule dependencyのいずれかが一意に決まらない。
- Issue snapshotが変化した。
- 上流判断を推測しなければ完全なRequirementsを作れない。
- in-scope修正後もvalidation gateを満たせない。

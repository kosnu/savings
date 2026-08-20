---
title: Design / Plan Goal Template
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
  - design-doc
  - planning
when_to_read:
  - Design Goalを構築するとき
---

# Design / Plan Goal

このGoalは設計成果物だけを所有し、実装しません。

## Goalへ含める情報

- 目的: 検証済みRequirements全体について実装方針と検証方針を定義する。
- Cycle identity: Issue snapshot、workspace、Requirements pathとSHA-256。
- Canonical input: validation済み`requirements.json`。生成Markdownを含めread-only。
- Rule selection: 対象path、domain、activity、topicから選んだ最小subgraph。
- Implementation context: 関連コード、ADR、policy、tests。
- Baseline: validatorがGit `HEAD`のcanonical `design-doc.json`から取得したsection inventoryとhash。
- Scope: 全Requirement IDのdesign/verification scopeと、全baseline sectionのreview scope。
- 所有する出力: canonical `design-doc.json`と生成`design-doc.md`。

## 必須contract ID

- constraints: `canonical-input`, `phase-boundary`
- stop: `validation-failure`, `scope-ambiguity`
- done: `complete-scope`, `validated-artifact`

[workflow](../workflow.md)の順序とcanonical textをそのまま使い、task固有entryだけを後ろへ追加します。

## Done / Verification

- 全Requirement IDがowned design evidenceとowned verification evidenceを持つ。
- 全baseline sectionがhashに基づき`preserved`または`replaced`に分類される。
- replaced sectionはowned baseline evidenceを持つ。
- Requirements再検証、Design coverage、canonical path、render同期が成功する。

## Stop

- canonical Requirementsが無効または現在Issue snapshotと不整合。
- 要求ごとの実装・検証方針を一意に決められない。
- 上流Requirementsの変更なしでは整合するDesignを作れない。
- in-scope修正後もDesign gateを満たせない。

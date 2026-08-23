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
- Cycle identity: Issue snapshot、workspace、Requirements pathとSHA-256。cycle-start titleは検証済みRequirementsが所有し、Design Goalへ再入力・複製しない。
- Canonical input: validation済み`requirements.json`。生成Markdownを含めread-only。
- Rule coverage: 実装予定面を`rule-map.json`のmachine review surfaceへ分類し、`rule_coverage.implementation_surfaces`と、予定pathに`applies_to.paths`が一致する固有nodeを含む必要な`additional_rules`をDesign Goalとartifactへ同一に記録する。最終selected ruleはvalidatorがRequirements選択、surface必須rule、additional rule、依存closureから計算する。
- Implementation context: 関連コード、ADR、policy、tests。
- Baseline: validatorがGit `HEAD`のcanonical `design-doc.json`から取得したsection inventoryとhash。
- Scope: 全Requirement IDのdesign/verification scopeと、全baseline sectionのreview scope。
- Product behavior inventory: 追加・変更・削除する全ユーザー操作と状態遷移をtyped `PB-*` recordにし、種別、change、canonical `requirement_id`だけを持たせる。Requirement本文は検証済み`requirements.json`だけが所有する。genericなsource kindや挙動本文の複製は置かない。選択済みruleはRequirementsとDesignを制約するが、不足する`requirement_id`の代替にはしない。各recordを同じRequirement IDのちょうど1件のdesign evidenceが所有する。
- 所有する出力: canonical `design-doc.json`、生成`design-doc.md`、検証後に固定するDesign completion receipt。

## 必須contract ID

- constraints: `canonical-input`, `phase-boundary`
- stop: `validation-failure`, `scope-ambiguity`
- done: `complete-scope`, `validated-artifact`

[workflow](../workflow.md)の順序とcanonical textをそのまま使い、task固有entryだけを後ろへ追加します。

## Done / Verification

- 全Requirement IDがowned design evidenceとowned verification evidenceを持つ。
- 全baseline sectionがhashに基づき`preserved`または`replaced`に分類される。
- replaced sectionはowned baseline evidenceを持つ。
- typed inventoryにないproduct behaviorをDesign proseへ追加せず、全recordの`requirement_id`が検証済みRequirementsに存在し、同じRequirement IDのdesign evidenceが1件だけ所有する。
- Requirements再検証、完全なretained Design Goal、Design coverage、canonical path、render同期が同じbyte snapshotに対して成功し、そのsnapshotから選択済みrule文書を含むDesign completion receiptを生成してSHA-256を完了証拠へ記録する。
- Design Goalとartifactのrule coverageが一致し、全implementation surfaceに必要なrule IDと依存closureがDesign completion receiptへ固定されている。

## Stop

- canonical Requirementsが無効または現在Issue snapshotと不整合。
- 要求ごとの実装・検証方針を一意に決められない。
- ユーザー操作または状態遷移を所有するRequirement IDがない。
- 実装予定面をmachine review surfaceへ分類できない、または必要なadditional ruleを一意に決められない。
- 上流Requirementsの変更なしでは整合するDesignを作れない。
- in-scope修正後もDesign gateを満たせない。

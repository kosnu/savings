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

- 目的: 検証済みRequirements全体からtask-owned範囲の完成状態と検証方針を定義する。
- Cycle identity: Issue snapshot、workspace、Requirements pathとSHA-256。cycle-start titleは検証済みRequirementsが所有し、Design Goalへ再入力・複製しない。
- Canonical input: validation済み`requirements.json`。生成Markdownを含めread-only。
- Rule coverage: Design時点のtask-owned範囲のbaseline pathと最終representation pathの和集合をmachine review surfaceへ分類し、`implementation_surfaces`と必要なpath固有`additional_rules`をDesign Goalとartifactへ同一に記録する。baseline inventoryはDesign completion receiptへ一度だけ固定し、Build側でworktreeから再構築させない。
- Implementation context: 関連コード、ADR、policy、tests。
- Baseline: validatorがGit `HEAD`のcanonical `design-doc.json`から取得したsection inventoryとhash。
- Scope: 全Requirement IDのdesign/verification scopeと、全baseline sectionのreview scope。
- Target state: schema v3の`validation.target_state`へ、最終的に観測可能な効果を表す実質的で同一Requirement/type内に一意なdescriptionを持つproduct behavior、全Requirementを覆うverification case、有限で非重複な`ownership_scopes`、最終representationを定義する。product behaviorに`change`を置かず、automated caseはrepo allowlistのcase-sensitiveな正規名（`pnpm`、`python3`、`node`、`git`、`jq`）と完全一致する実行fileを使う直接command引数列、manual caseは実質的なprocedureを持つ。representationはowned pathとlocator metadataを持つが、locatorからsource構文やtest runner規則を推論しない。全参照は同じRequirement owner内に閉じる。
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
- 全product behavior、verification case、representationがcanonical Requirementへbindingされ、全Requirementとbehaviorに検証経路がある。
- 全representationがownership scope内にあり、Story/testはmachine-addressable locatorを持つ。
- Requirements再検証、完全なretained Design Goal、Design coverage、canonical path、render同期が同じbyte snapshotに対して成功し、そのsnapshotから選択済みrule文書を含むDesign completion receiptを生成してSHA-256を完了証拠へ記録する。
- Design Goalとartifactのrule coverageが一致し、全implementation surfaceに必要なrule IDと依存closureがDesign completion receiptへ固定されている。

## Stop

- canonical Requirementsが無効または現在Issue snapshotと不整合。
- 要求ごとの実装・検証方針を一意に決められない。
- ユーザー操作または状態遷移を所有するRequirement IDがない。
- baseline pathまたは最終representationをmachine review surfaceへ分類できない、または必要なadditional ruleを一意に決められない。
- 上流Requirementsの変更なしでは整合するDesignを作れない。
- in-scope修正後もDesign gateを満たせない。

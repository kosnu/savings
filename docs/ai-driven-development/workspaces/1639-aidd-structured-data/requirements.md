---
title: "Requirements: AIDD成果物の正本を構造化データへ移行する"
doc_type: requirements
status: proposed
area: repository
applies_to:
  - .agents/skills/aidd-cycle
  - .agents/skills/goal-setting
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - requirements
  - design-doc
  - structured-data
  - validation
when_to_read:
  - Issue #1639の設計、実装、検証を行うとき
  - AIDD成果物の機械検証正本とMarkdown表示の責務を確認するとき
---

# Requirements: AIDD成果物の正本を構造化データへ移行する

- Issue: `kosnu/savings#1639`
- Issue URL: `https://github.com/kosnu/savings/issues/1639`
- Issue updatedAt: `2026-08-09T06:19:50Z`
- Issue本文SHA-256: `d523361f46e547e89baf0eaa5dba8b2a3d24b10f8c00e2be9ad0a0dd43bc40f7`
- Cycle ID: `69f83938-0905-46a7-abad-0003607c057a`
- Workspace: `1639-aidd-structured-data`

## Requirements Input Gate

```json
{"task_context":{"source":"issue_body","issue":"kosnu/savings#1639","url":"https://github.com/kosnu/savings/issues/1639","updated_at":"2026-08-09T06:19:50Z","body_sha256":"d523361f46e547e89baf0eaa5dba8b2a3d24b10f8c00e2be9ad0a0dd43bc40f7"},"direct_rules":[{"id":"ai-driven.workflow","issue_evidence":"validator、workflow、template","match":{"field":"topics","value":"workflow"},"reason":"workflow同期がscope","explicit_surface":"workflow"},{"id":"ai-driven.goal-templates","issue_evidence":"RequirementsとDesignの構造化正本\n- validator、workflow、template","match":{"field":"topics","value":"requirements"},"reason":"AIDD template同期がscope"}],"depends_on":[{"id":"ai-driven.overview","via":"ai-driven.workflow"}]}
```

## Requirements Completeness Gate

```json
{"issue_body_sha256":"d523361f46e547e89baf0eaa5dba8b2a3d24b10f8c00e2be9ad0a0dd43bc40f7","workspace":"1639-aidd-structured-data","baseline":{"source":"git_head","body_sha256":"6682fbe4800aba130710002140104772a3b75dec4e8cab2c9e2b3f5a802a9df9"},"requirements":[{"id":"FR-1","status":"changed","issue_evidence":"YAMLとJSONのどちらにするか"},{"id":"FR-2","status":"changed","issue_evidence":"validatorはその正本だけを検証する"},{"id":"FR-3","status":"changed","issue_evidence":"Markdownを正本から生成する方法"},{"id":"FR-4","status":"changed","issue_evidence":"既存成果物の移行方法"},{"id":"NFR-1","status":"changed","issue_evidence":"二重の手編集正本にしない"},{"id":"NFR-2","status":"changed","issue_evidence":"provenance検証を弱めない"},{"id":"NFR-3","status":"changed","issue_evidence":"requirements.mdとdesign-doc.mdの2つを維持する"},{"id":"AC-1","status":"changed","issue_evidence":"RequirementsとDesignの機械検証が構造化正本のみを入力として行われる"},{"id":"AC-2","status":"changed","issue_evidence":"Markdownの表示構造を偽装してvalidatorを通過できない"},{"id":"AC-3","status":"changed","issue_evidence":"既存成果物の移行方針と検証が用意される"},{"id":"AC-4","status":"changed","issue_evidence":"workflow・template・テストが新しい正本に同期する"}],"sections":[{"id":"background","status":"changed","issue_evidence":"見出し表現に由来する検証の抜け道が繰り返し発生している"},{"id":"users","status":"changed","issue_evidence":"人間向けの表現性と機械検証の正確性"},{"id":"stories","status":"changed","issue_evidence":"Markdownは人間が読む表示として残す"},{"id":"scope","status":"changed","issue_evidence":"AIDD以外の文書形式変更"},{"id":"functional","status":"changed","issue_evidence":"RequirementsとDesignの構造化正本"},{"id":"non-functional","status":"changed","issue_evidence":"構造化データとMarkdownを二重の手編集正本にしない"},{"id":"acceptance","status":"changed","issue_evidence":"RequirementsとDesignの機械検証が構造化正本のみを入力として行われる"},{"id":"qa","status":"changed","issue_evidence":"判断したいこと"},{"id":"technical","status":"changed","issue_evidence":"Markdown表示の生成と回帰テスト"}],"retired":[]}
```

## 背景

AIDD成果物はMarkdown本文の構造から機械検証用データを抽出しており、コードフェンス・HTMLブロック・見出し表現に由来する検証の抜け道が繰り返し発生している。人間向け表示の自由度と機械判定の境界を分離し、検証対象を曖昧さのない構造へ固定する必要がある。

## 対象ユーザーと利用シーン

人間向けの表現性と機械検証の正確性を両立させる必要がある、AIDD成果物の作成者・レビュー担当者・workflow実行者を対象とする。人間は従来のMarkdownを読み、agentとvalidatorは構造化正本を生成・検証・移行に利用する。

## ユーザーストーリー

- AIDD成果物の作成者として、機械判定可能な正本を一か所だけ編集し、表示文書との不整合を生じさせたくない。
- レビュー担当者として、Markdownは人間が読む表示として残すことで、既存のレビュー導線を維持したい。
- workflow実行者として、表示上の細工に影響されず、同じ構造化入力から同じ検証結果を得たい。

## スコープ

### 対象

- 両AIDD成果物の構造化正本、および機械検証に必要なprovenance・continuity・coverage情報。
- 構造化正本からのMarkdown表示生成。
- validator、workflow、Goal template、skill、回帰テストの同期。
- Git `HEAD`に存在する既存AIDD workspace成果物の移行と検証。

### 対象外

- Markdownの個別表現だけを塞ぐ対症療法。
- AIDD以外の文書形式変更。
- アプリケーションのDB、API、認証、UIデータモデル。

## 機能要件

RequirementsとDesignの構造化正本を導入し、次を満たす。

- FR-1: Issueの「YAMLとJSONのどちらにするか」に対し、Python標準ライブラリで厳密にparseでき、既存validatorとrule\-mapで実績があるJSONを構造化正本形式として採用する。
- FR-2: 構造化正本を機械判定の唯一の入力とし、validatorはその正本だけを検証する。生成Markdownの見出し、コードフェンス、HTMLは機械判定へ入力しない。
- FR-3: 構造化正本から決定的にMarkdownを出力する「Markdownを正本から生成する方法」を提供し、生成差分によって表示の同期を確認できるようにする。
- FR-4: Git \`HEAD\`の全AIDD workspaceについて、要求ID、section、coverage、provenance、本文表示を保持する「既存成果物の移行方法」を定義し、一括変換と検証を可能にする。

## 非機能要件

- NFR-1: 構造化データとMarkdownを二重の手編集正本にしない。人が編集する機械判定の正本はJSONだけとし、Markdownは再生成可能な派生成果物にする。
- NFR-2: 既存のIssue snapshot、direct rule evidence、dependency closure、baseline continuity、requirement coverageを保持し、provenance検証を弱めない。
- NFR-3: 人間向け導線とcanonical workspaceを維持するため、requirements\.mdとdesign\-doc\.mdの2つを維持する。

## 受け入れ条件

- AC-1: RequirementsとDesignの機械検証が構造化正本のみを入力として行われる。Markdownを変更しても構造化正本の検証結果は変わらず、生成一致検証だけが表示のずれを検出する。
- AC-2: Markdownの表示構造を偽装してvalidatorを通過できない。コードフェンス、HTML comment、偽見出しを含む表示は機械判定データとして解釈されないことを回帰テストで確認する。
- AC-3: 既存成果物の移行方針と検証が用意される。全workspaceのJSONがschema検証を通り、生成Markdownが期待する人間向け内容とcanonical pathを保持する。
- AC-4: workflow・template・テストが新しい正本に同期する。skillとGoal templateもJSON正本を入力・出力として案内し、旧Markdown抽出を正規経路に残さない。

## Q\&A

- Q: Issueの判断したいことにある正本形式は何か。
  - A: JSONとする。YAMLより記法の解釈幅が狭く、Python標準ライブラリで処理でき、新規依存を要しないため。
- Q: Markdownはどう生成するか。
  - A: JSON schemaで順序を持つ表示sectionを表現し、共通rendererが`requirements.md`または`design-doc.md`を決定的に生成する。生成後のMarkdownを手編集しない。
- Q: 既存成果物はどう移行するか。
  - A: 現行validatorが認識する内容と人間向け本文を一度だけJSONへ移し、schema検証、Markdown再生成、全workspace回帰検証を同じ変更で完了する。履歴はGitに残す。

## 技術的考慮事項

- Markdown表示の生成と回帰テストは、JSON parse・schema検証・render・生成一致確認を分離して失敗理由を明確にする。
- JSON schemaはRequirementsとDesignの共通metadataと、各artifact固有のrequirements/sections/coverageを識別可能にする。
- validator APIはcanonical JSON pathだけを受け付け、temporary copyやsymlink aliasを既存と同等に拒否する。
- 移行後もworkflow上の同一cycle read-only境界、Goal gate一致、Issue再取得確認を維持する。

## Rule Selection

- Direct: `ai-driven.workflow`。workflow同期がscope。
- Direct: `ai-driven.goal-templates`。AIDD template同期がscope。
- Depends-on: `ai-driven.overview`（via `ai-driven.workflow`）。
- Conflict: none。

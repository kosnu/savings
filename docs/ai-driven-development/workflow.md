---
title: AI Driven Development Workflow
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - workflow
  - prd
  - design-doc
  - pull-request
when_to_read:
  - AI駆動開発の工程と成果物境界を判断するとき
  - Codex Goalの遷移、完了条件、停止条件を確認するとき
---

# AI Driven Development Workflow

このリポジトリのAIDDは、次の4工程を順に実行します。

1. Intent / Requirements
2. Design / Plan
3. Build / Verify
4. Ship

新しいサイクルは必ずIntent / Requirementsから始めます。後続工程へ進めるのは、直前のGoalが完了し、その工程の成果物と検証証拠が揃った場合だけです。ファイルの存在、テストの成功、Goal案の作成だけでは工程完了になりません。

## サイクルとGoalの状態

同時に扱うGoalは1件です。開始前に現在のGoalを確認します。

- 同じサイクルの未完了Goalがあれば、そのGoalを続行する。
- 別タスクの未完了Goalがあれば、置き換えず停止する。
- pausedはユーザーまたはシステムが所有する状態とし、agentは再開操作を推測しない。
- objective、Done、Verificationを満たしたときだけ`complete`にする。
- 進展可能な間はactiveを維持する。同じ阻害条件が3回以上連続し、安全な代替経路もない場合だけ`blocked`にする。
- 終端更新後は状態を再取得して確認してから次工程へ進む。

## Task Contextとworkspace

RequirementsのTask Context正本は、サイクル開始時に取得した最新Issue本文だけです。会話、レビューコメント、現在のdiff、前回成果物、変更直後のルールはRequirementsを追加しません。前回成果物は欠落検出用baselineとしてのみ利用します。

Issueごとにworkspaceは1件です。既存が1件なら再利用し、0件なら`<Issue番号>-<短いtitle>`を作成し、複数なら統合先を推測せず停止します。新しいサイクルを別workspaceへ逃がさないため、workspace名にはversion、revision、cycle、retry、rerunを表すmarkerを使いません。Issue番号との一意な対応とcanonical pathで同一性を検証します。

## 成果物モデル

`requirements.json`と`design-doc.json`が機械判定の正本です。`requirements.md`と`design-doc.md`はJSONから決定的に生成する表示であり、通常validatorは解析しません。

構造上の意味は次で表します。

- requirement、section、block、contractの安定ID
- transitionのstatus
- evidenceの`role`と`owner_id`
- artifact、Issue、baselineのSHA-256
- gate内の参照関係と完全なinventory

ID、owner、role、reference、hash、inventoryが成果物の主要な機械構造です。現行schema v2はこれに加えて、canonical heading、非placeholderの実質的な説明、Issueに実在して対象recordへ一意に対応するevidenceをartifact format gateとして検証します。これらの表示・証拠条件だけで工程完了とは判断せず、Goalのobjective、Done、Verificationも満たす必要があります。

## 工程契約

### Intent / Requirements

- 入力: 最新Issue snapshot、canonical rule map、Git `HEAD`の同一workspace Requirements baseline。
- 所有: canonical `requirements.json`と生成`requirements.md`。
- 完了: Issue全体を表す全Requirement IDと必須sectionが定義され、baselineの全recordが`unchanged`、`changed`、`new`、`retired`のいずれかで説明され、provenance、continuity、render同期が成功している。
- 停止: Issueまたはworkspaceが曖昧、Issue snapshotが工程中に変化、rule dependencyが解けない、完全な要求scopeを決められない、gateを満たせない。

### Design / Plan

- 入力: 検証済みcanonical Requirements全体、選択ルール、実装文脈、Git `HEAD`の同一workspace Design baseline。Requirementsはread-only。
- 所有: canonical `design-doc.json`と生成`design-doc.md`。
- 完了: 全Requirement IDがdesign evidenceとverification evidenceを所有し、全baseline sectionがhashにより`preserved`または`replaced`へ分類され、coverageとrender同期が成功している。
- 停止: Requirements再検証失敗、要求ごとの実装または検証方針を決められない、baseline transitionが不完全、Design gateを満たせない。

### Build / Verify

- 入力: 検証済みRequirementsとDesign全体。両成果物はread-only。
- 所有: 必要な実装、テスト、fixture、runtime設定と、その検証証拠。
- 完了: 全RequirementとDesign方針を実装し、対象appの必須verificationが成功し、未解消の要件漏れや整合性問題がない。
- 停止: 上流成果物の不足・矛盾を解釈で埋める必要がある、許可範囲を越える変更が必要、外部権限なしでは検証不能。

### Ship

- 入力: Build / Verify完了済みdiff、検証結果、Issue、branch、必要なPRまたはreview context。
- 所有: commit、push、PR、説明、許可されたreview replyとthread状態確認。
- 完了: 要求されたdelivery操作が完了し、直前にGit、CI、PR、thread状態を再確認している。commitまたはlocal testだけをShip完了としない。
- 停止: delivery先や公開権限が曖昧、Build証拠が現在diffと一致しない、公開前に実装変更が必要、必須CIまたはreview状態が未確定。

## Goal contract ID

RequirementsとDesignの一時Goal JSONは、次のentryを表の順序とtextで持ちます。task固有entryは必須entryの後に追加します。

| Goal | Field | ID | Canonical text |
| --- | --- | --- | --- |
| Requirements | constraints | `task-context` | 最新Issue本文だけをTask Context正本として扱う。 |
| Requirements | constraints | `phase-boundary` | Requirements Goal内では実装しない。 |
| Requirements | stop | `validation-failure` | workspaceまたはRequirements Gateの検証が失敗した場合は停止する。 |
| Requirements | stop | `scope-ambiguity` | Issue本文から要求scopeを一意に決められない場合は停止する。 |
| Requirements | done | `complete-scope` | 最新Issue全体を覆うRequirementsと全要求IDを定義する。 |
| Requirements | done | `validated-artifact` | Requirements Gateと生成成果物の同期検証を成功させる。 |
| Design | constraints | `canonical-input` | 検証済みのcanonical requirements.jsonをread-only入力として扱う。 |
| Design | constraints | `phase-boundary` | Design Goal内では実装しない。 |
| Design | stop | `validation-failure` | Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。 |
| Design | stop | `scope-ambiguity` | 要求ごとの設計・検証scopeを一意に決められない場合は停止する。 |
| Design | done | `complete-scope` | 全Requirements IDとbaseline sectionのDesign coverageを定義する。 |
| Design | done | `validated-artifact` | Design Coverage Gateと生成成果物の同期検証を成功させる。 |

## Learn

Learnは工程Goalではありません。Ship完了後、または上流成果物の不足・矛盾でGoalが`blocked`になった後に、ユーザーが明示的に実行します。findingは、Issue本文の変更案、rule/policyの追加・変更、または既存rule/policyのsharp化へ分類します。Issue変更案は実際にIssueへ適用されるまで次サイクルのTask Contextではありません。

---
title: "Requirements / PRD: プロフィール表示名の境界修正"
doc_type: requirements
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - requirements
  - profile
  - user
  - validation
  - forms
  - transaction-boundaries
---

# Requirements / PRD: プロフィール表示名の境界修正

## 背景と課題

Issue #1552のプロフィール編集では、表示名のアプリケーション上限を64文字とし、ユーザー編集時は超過を拒否し、初期登録時は先頭64文字を採用することが決まっている。

追加レビューにより、保存を受け付けてから更新処理が開始するまでの短い時間に、Saveは操作不可でも表示名を編集できる可能性が判明した。また、初期登録値の正規化について、操作の実行境界を理由にアプリケーション固有ルールの所有先をDB/RPCへ移していたことが、更新済みのtransaction boundary policyに適合しないと確認された。

このRequirementsでは、ユーザー可視の表示名仕様を変えず、保存操作の一体性と正本ルールへの適合を成立させる。

## ありたい状態

ユーザーは、表示名の保存を開始してから結果が確定するまで送信対象を変更できず、Saveと入力欄が同じ保存操作として振る舞う。初回登録時は長い表示名でも既存仕様どおり先頭64文字で登録を完了でき、その実現方法はリポジトリのルール所有境界に適合している。

## 対象ユーザーと利用シーン

- 表示名を編集する認証済みユーザー: 保存中の値と保存結果が食い違わない状態で更新したい。
- 初回認証後にプロフィールが作られるユーザー: 認証情報の表示名が64文字を超えても利用開始したい。

## ユーザーストーリー

- 認証済みユーザーとして、保存中の表示名を誤って変更せず、確定した値を理解したい。
- 新規ユーザーとして、初期表示名が64文字を超えてもプロフィール作成を完了したい。

## スコープ

### 対象

- 表示名保存中の入力欄とSave操作の一体性。
- 表示名の64文字上限、編集時の超過拒否、初期登録時の先頭64文字採用という既存挙動の維持。
- 64文字、65文字、保存開始直後、保存完了後の回帰検証。
- 更新済みのWeb form ruleとtransaction boundary policyへの適合。

### 対象外

- 表示名上限値または文字数の数え方の変更。
- メールアドレス、ログイン方法、言語設定、Retry操作の仕様変更。
- DB schema、認証・認可、RLS、権限モデルの変更。
- 新しいユーザー操作、画面遷移、通知の追加。
- 既存の1552系Requirements / Design Docの編集。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/1552-profile-boundary-correction-v3/`, `apps/web/src/features/profile/**`, `apps/web/src/providers/supabase/**`, `apps/api/supabase/**`
  - domain: `user`, `auth`, `web`
  - activity: `change_form`, `change_auth_assumption`, `review_test_gap`, `change_transaction_boundary`
  - topic: `profile`, `validation`, `forms`, `rpc`, `test`
- Selected nodes:
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: 新しいcycleとartifact境界を守るため。
  - `domain.user` -> `docs/harness/domain/user.md`: 表示名64文字と初期登録時の扱いを維持するため。
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`: 保存を1つのユーザー操作状態として扱うため。
  - `policy.transaction-boundaries` -> `docs/harness/policies/transaction-boundaries.md`: 操作の実行境界と値ルールの所有境界を分けるため。
  - `web.component-structure` -> `apps/web/docs/policies/component-structure.md`: Web componentを変更する場合の責務境界を守るため。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: ユーザーに残る境界挙動を回帰検証するため。
  - `web.storybook-browser-tests` -> `apps/web/docs/policies/storybook-browser-tests.md`: Storyとテストの責務を維持するため。
  - `documentation.policy` -> `docs/harness/policies/documentation-policy.md`: artifact形式を守るため。
- Depends-on nodes: 追加なし。
- Conflict decision: IssueのTask Contextはユーザー可視の表示名境界を定め、正本ルールは実装責務を定めるため競合しない。Task Contextへ実装方式を追加せず、両方をそれぞれの正本として適用する。

## Domain Value Intent

| 値 / 状態 | ユーザーが判断したいこと | Requirements上の境界 |
| --- | --- | --- |
| 編集する表示名 | 保存可能な値か | 64文字以内は既存条件を満たせば保存でき、64文字超は保存前に拒否される。 |
| 初期登録する表示名 | 初回登録を完了できるか | 64文字超は先頭64文字を採用し、登録を継続する。 |
| 保存中状態 | 入力や再送信が可能か | 保存結果が確定して再操作可能になるまでは、送信対象とSaveを操作できない。 |
| 保存結果 | どの値が確定したか | 保存中に送信対象が変化せず、既存の成功・失敗表示で結果を理解できる。 |

## 機能要件

### FR-1: 保存を1つのユーザー操作として扱う

- 保存を受け付けた時点から結果が確定して再操作可能になるまで、表示名入力とSaveを操作できない。
- 表示名入力とSaveの操作可否に時間差を作らない。
- 保存成功時と保存失敗時は、既存の結果表示と入力値保持の仕様を維持する。

### FR-2: 表示名の既存境界を維持する

- 64文字以内の編集値は、既存の必須条件などを満たす場合に保存できる。
- 64文字を超える編集値は、保存を開始せずfield validation errorとして拒否する。
- 初期登録値が64文字を超える場合は先頭64文字を採用し、登録を継続する。
- ユーザー編集値は自動的に切り詰めない。

### FR-3: 既存機能を維持する

- メールアドレス、ログイン方法、言語設定、プロフィール取得・更新結果の既存表示を変えない。
- 認証・認可、RLS、権限、DB schemaを変更しない。

## 非機能要件と制約

- 実装は`docs/harness/policies/transaction-boundaries.md`の実行境界とルール所有境界に適合する。
- Web formの操作状態は`apps/web/docs/policies/design-rules.md`に適合する。
- 表示名は表示用途に限り、本人確認、認証、認可、権限判定に利用しない。
- 実装方式はDesign / Planで決定し、Requirementsではcomponent、Hook、state、RPC引数、SQLを指定しない。
- IssueのTask Contextと正本ルールに同じ実装判断を重複して記録しない。

## 受け入れ条件

- AC-1: 64文字の表示名は、他のvalidationを満たす場合に保存できる。
- AC-2: 65文字の表示名は保存を開始せず、field validation errorで拒否される。
- AC-3: 65文字以上の編集値は自動的に切り詰められない。
- AC-4: 65文字以上の初期登録値は先頭64文字で登録される。
- AC-5: 保存を受け付けた直後から結果が確定するまで、表示名入力とSaveの両方が操作できない。
- AC-6: 保存が成功または失敗して再操作可能になった後、表示名入力とSaveの操作可否が同じ保存結果に基づいて復帰する。
- AC-7: 既存の成功・失敗表示、入力値保持、LanguageSelect、provider fallback、Retry操作を壊さない。
- AC-8: DB schema、認証・認可、RLS、権限モデルを変更しない。
- AC-9: 実装が選択した正本ルールのルール所有境界とWeb form操作状態に適合する。

## Q&Aログ

- Q: 64文字上限や初期登録時の切り詰めを変更するか？
  - A: 変更しない。Issue #1552のTask Contextにあるユーザー可視挙動を維持する。
- Q: 層の所有権をTask Contextへ追加するか？
  - A: 追加しない。実装責務は正本ルールを適用し、Task Contextと重複させない。
- Q: 保存中の入力無効化を実装方式として指定するか？
  - A: 指定しない。保存操作中に入力とSaveを同時に操作不可とする結果を要求し、方法はDesign / Planで決める。
- Q: 初期登録の内部契約をRequirementsで固定するか？
  - A: 固定しない。ユーザー可視結果と守るべき正本ルールだけを固定する。

## 技術的考慮事項

- Design / Planでは、初期登録の実行境界、表示名ルールの所有境界、境界間で受け渡す値を分けて整理する。
- 保存開始直後の短い状態差を再現できる検証方法を定める。
- 既存のStoryを状態の正本として再利用し、直接componentを使う例外が必要な場合はtest policyに従う。

## Verification

この成果物はdocumentation-onlyのRequirements / PRDであり、アプリ検証は実行しない。次を確認する。

- Issue #1552、未解決review thread、選択した正本ルールへ各要件を追跡できる。
- Task Contextのユーザー可視要件と正本ルールの実装責務を重複させていない。
- 64文字、65文字、初期登録、保存開始直後、保存完了後が受け入れ条件に対応している。
- component、Hook、state、RPC引数、SQLなどの実装方式を規定していない。
- 既存の1552系artifactを変更していない。
- `git diff --check`が成功する。

## Stop条件

- 正本ルールへの適合にユーザー可視要件の変更が必要になる。
- DB schema、認証・認可、RLS、権限モデルの変更が必要になる。
- 保存操作の一体性と既存の保存結果仕様を両立できない。
- Issueと未解決review threadが矛盾し、一意に解消できない。
- 既存の1552系artifactの破壊的更新が必要になる。

## 次工程への入力

- Artifact lineage: `docs/ai-driven-development/workspaces/1552-profile-boundary-correction-v3/`
- Design / Planでは、この`requirements.md`をread-only入力として、保存操作の一体性と初期登録値のルール所有境界を実装可能な方針へ落とし込む。

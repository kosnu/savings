---
title: "Requirements / PRD: プロフィール表示名制約とRetry focusのフォローアップ"
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
  - accessibility
  - authentication
---

# Requirements / PRD: プロフィール表示名制約とRetry focusのフォローアップ

## 背景と課題

Issue #1552では、認証済みユーザーがプロフィール情報を確認し、表示名だけを編集できることを要求している。後続レビューと監督判断により、次の不足が明確になった。

- 表示名のアプリケーション上限が定義されておらず、保存先の制約に到達してから汎用エラーになる可能性がある。
- 初期登録値がアプリケーション上限を超える場合の扱いが定義されていない。
- Retry失敗時に、一時的にdisabledとなるRetry操作へfocusを戻す要件が実ブラウザで成立しない可能性がある。

このRequirementsでは、Issue #1552の機能境界を広げず、表示名の64文字制約、初期登録時の正規化、Retry失敗後のキーボード操作継続を検証可能な要求として定義する。

## ありたい状態

ユーザーが編集する表示名は64文字以内で保存でき、64文字を超える場合は保存前に入力欄で修正理由を理解できる。認証情報から作られる初期表示名が64文字を超える場合は、初期登録を失敗させず先頭64文字を登録する。プロフィール取得のRetryに失敗した場合は、エラー状態とRetry操作を維持し、キーボード利用者がfocusを失わず再操作できる。

## 対象ユーザーと利用シーン

- 表示名を編集する認証済みユーザー: 保存可能な文字数を入力欄で理解したい。
- 初回認証後にプロフィールが作られるユーザー: 認証メタデータの名前が長くても利用開始したい。
- キーボード利用者: プロフィール取得のRetryに失敗しても、次のRetryを継続したい。

## ユーザーストーリー

- 認証済みユーザーとして、表示名が長すぎる場合は保存前に修正したい。
- 新規ユーザーとして、初期表示名が長くてもプロフィール作成を完了したい。
- キーボード利用者として、Retry失敗後もfocusを失わず同じ操作をやり直したい。

## スコープ

### 対象

- ユーザー編集時の表示名最大64文字validation。
- 64文字を超える初期登録値を先頭64文字へ切り詰めること。
- Retry失敗時にerror fallbackとRetry操作を維持し、再操作可能な状態へfocusを戻すこと。
- 64文字、65文字、初期登録値の切り詰め、Retry失敗時focusの回帰検証。
- 既存のLanguageSelect操作とprovider fallbackを壊さないこと。

### 対象外

- DBの文字数上限、table、column、RLS、権限モデルの変更。
- email、ログイン方法、言語設定の仕様変更。
- 表示名以外のプロフィール情報の更新。
- Retry以外の新しい復帰操作や画面遷移の追加。
- 既存の1552系Requirements / Design Docの編集。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/1552-profile-review-follow-up-v2/requirements.md`, `apps/web/src/features/profile/**`, `apps/web/src/providers/supabase/**`, `apps/api/supabase/migrations/**`
  - domain: `user`, `auth`, `web`
  - activity: `change_user_behavior`, `change_form`, `change_auth_assumption`, `review_test_gap`
  - topic: `profile`, `validation`, `accessibility`, `auth`, `test`
- Selected nodes:
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: 新しいcycleとartifact境界を守るため。
  - `domain.user` -> `docs/harness/domain/user.md`: 表示名64文字、編集時拒否、初期登録時切り詰めの正本。
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`: field error、disabled、focusを含む状態表現のため。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: ユーザーに残る境界挙動を回帰検証するため。
  - `documentation.policy` -> `docs/harness/policies/documentation-policy.md`: artifactの文書形式を守るため。
- Depends-on nodes: 追加なし。
- Conflict decision: Issueの古い一般的なDB変更Stop条件に対し、最新のTask Contextは既存の初期登録境界での切り詰めを明示している。table、column、API契約、Auth方式は変更せず、既存境界の入力正規化だけを対象とする。

## Domain Value Intent

| 値 / 状態 | ユーザーが判断したいこと | Requirements上の境界 |
| --- | --- | --- |
| 編集する表示名 | 保存可能な長さか | 64文字以内は入力可能。64文字超は保存前にfield validationで拒否し、自動切り詰めしない。 |
| 初期登録する表示名 | 初回プロフィール作成を完了できるか | 64文字超は先頭64文字へ切り詰める。ユーザー編集時の扱いとは分ける。 |
| Retry失敗状態 | 再試行できるか | error fallbackとRetry操作を維持し、Retryが再び操作可能になった状態でfocusを失わせない。 |
| LanguageSelect / provider表示 | 既存機能が利用・確認できるか | 表示名制約とRetry修正によって既存仕様を変えない。 |

## 機能要件

### FR-1: 編集する表示名を64文字以内に制限する

- 表示名はアプリケーション上で最大64文字とする。
- 64文字以内の表示名は、既存の必須条件など他のvalidationを満たす場合に保存できる。
- 64文字を超える入力は、保存処理を開始せずfield validation errorとして表示する。
- ユーザーが編集した値を自動的に64文字へ切り詰めない。
- 上限エラーはユーザーが64文字以内へ修正できる内容にする。

### FR-2: 初期登録値だけを上限内へ正規化する

- 認証情報から初期登録する表示名が64文字以内の場合は、その値を維持する。
- 初期登録する表示名が64文字を超える場合は、先頭64文字へ切り詰めて登録する。
- この切り詰めは初期登録時だけに適用し、ユーザー編集時には適用しない。
- 既存の表示名を一括変更せず、DBの文字数上限やschemaを変更しない。

### FR-3: Retry失敗後もキーボード操作を継続できる

- Retry開始中は多重操作を防ぎ、処理中であることを示す。
- Retryが失敗した場合は、プロフィールのerror fallbackとRetry操作を維持する。
- Retryが再び操作可能になった後、キーボード利用者がfocusを失わずRetryを再実行できる。
- Retry成功時の既存の復帰先と、LanguageSelectの独立した操作性を壊さない。

## 非機能要件と制約

- 表示名は表示用途に限り、監査、権限、本人確認に利用しない。
- field validation errorと保存後のserver errorを混同しない。
- エラーは色だけに依存しない。
- 文字数の判定はWebと初期登録境界で同じ64文字上限として整合させる。
- 初期登録の正規化以外に、Auth metadata、email、providerを変更しない。
- 新規依存、DB schema、API契約、Auth方式、権限、RLSの変更を前提にしない。
- Issue #1552、明示Task Context、`domain.user`から追跡できない操作や成功条件を追加しない。

## 受け入れ条件

- AC-1: 64文字の表示名は、他のvalidationを満たす場合に保存できる。
- AC-2: 65文字の表示名は保存処理を開始せず、入力欄のvalidation errorで64文字以内への修正を求める。
- AC-3: ユーザーが編集した65文字以上の値は自動的に切り詰められない。
- AC-4: 64文字以内の初期登録値は変更されずに登録される。
- AC-5: 65文字以上の初期登録値は先頭64文字へ切り詰めて登録される。
- AC-6: 初期登録値の正規化のためにDB schema、API契約、Auth方式、権限、RLSを変更しない。
- AC-7: Retry失敗後、Retry操作が再び有効になり、実ブラウザでfocusがRetry操作にある。
- AC-8: Retry成功時の復帰、LanguageSelectの操作、provider fallbackの既存要件を壊さない。
- AC-9: Requirements / PRDが選択したrule-mapサブグラフに違反しない。

## Q&Aログ

- Q: DBの255文字上限をアプリケーション上限にするか？
  - A: しない。アプリケーション上限は64文字とする。
- Q: 65文字以上の編集値を保存時に切り詰めるか？
  - A: 切り詰めない。field validationで拒否し、ユーザーが修正する。
- Q: 初期登録値もエラーにするか？
  - A: しない。初期登録値だけは先頭64文字へ切り詰め、登録を継続する。
- Q: 既存ユーザーの64文字超の表示名を一括更新するか？
  - A: しない。対象は今後の編集と初期登録である。
- Q: Retryは新しく追加する操作か？
  - A: 追加しない。Issue #1552に明示済みのRetry操作について、失敗後のfocus要件を成立させる。
- Q: Retry失敗時の具体的なstate管理方法をRequirementsで決めるか？
  - A: 決めない。disabled解除後にfocusが成立する結果を要求し、方法はDesign / Planで決める。

## 技術的考慮事項

- Design / Planでは、表示名上限の正本とWeb validation、初期登録境界での正規化、翻訳メッセージ、境界値テストの同期方法を決める。
- 初期登録値の切り詰めは既存の初期登録処理内で完結させ、tableやAPI契約を増やさない。
- Retry失敗時focusはDOMエミュレーションだけに依存せず、実ブラウザでのfocusabilityを検証する。
- 文字数判定の具体的な実装は、既存の文字列validation規約と整合させ、Design / Planで明示する。

## Verification

この成果物はdocumentation-onlyのRequirements / PRDであり、アプリ検証は実行しない。次を確認する。

- Issue #1552のTask Contextと`domain.user`へ要求を追跡できる。
- 64文字/65文字、初期登録時切り詰め、Retry失敗時focusがACに対応している。
- ユーザー編集時と初期登録時の扱いを混同していない。
- 未承認の新しい操作、DB schema/API/Auth方式変更を要求していない。
- 既存の1552系artifactを変更していない。
- `git diff --check`が成功する。

## Stop条件

- 64文字上限または初期登録時切り詰めが`domain.user`と矛盾する。
- ユーザー編集時と初期登録時の入力境界を分離できない。
- table、column、API契約、Auth方式、権限、RLSの変更が必要になる。
- Retry以外の新しいユーザー操作または画面遷移が必要になる。
- 実ブラウザでRetry失敗後のfocus継続を検証できない。
- Requirementsがselected rule-map subgraphに違反する。

## 次工程への入力

- Artifact lineage: `docs/ai-driven-development/workspaces/1552-profile-review-follow-up-v2/`
- Design / Planでは、この`requirements.md`をread-only入力として、表示名上限、初期登録時正規化、Retry focus、翻訳、テスト境界を実装可能な方針へ落とし込む。

---
title: "Requirements / PRD: プロフィール情報表示・編集のフォローアップ"
doc_type: requirements
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
topics:
  - ai-driven-development
  - requirements
  - profile
  - settings
  - user
  - auth
  - accessibility
  - async-state
---

# Requirements / PRD: プロフィール情報表示・編集のフォローアップ

## 背景と課題

Issue #1552 は、設定画面で認証済みユーザーが自分の登録情報を確認し、表示名だけを編集できるようにする要求である。Build / Verify 後の Learn で、プロフィール画面に固有の追加要求と、複数タスクに適用する正本ルールが整理された。

このRequirementsでは、Issue #1552の意図・対象外・制約を維持したまま、次のユーザー体験を明確にする。

- プロフィール情報の再取得に失敗したとき、保存成功と誤認させない。
- 取得失敗から再試行するとき、キーボード操作のfocusを失わせない。
- プロフィールの取得状態にかかわらず、既存の言語設定を使える。
- ログイン方法の表示に必要なprovider情報が一方の認証メタデータにない場合も、確認可能な情報を表示する。

## 現在の課題

- 初回のプロフィール情報表示・編集要求だけでは、再取得失敗後の成功表示、Retry後のfocus、プロフィール状態とLanguageSelectの共存、provider情報のfallback条件が十分に定義されていない。
- これらを実装詳細ではなく、ユーザーが判断できる状態と成功条件として定義する必要がある。

## ありたい状態

認証済みユーザーは、設定 > プロフィールで自分の登録情報を確認し、表示名を編集できる。保存処理が完了しても、source of truthの再取得に失敗した場合は成功済みと誤認しない。プロフィール情報の取得中・取得失敗中でも、既存のLanguageSelectを利用できる。取得失敗からRetryした場合、キーボード利用者はfocusを失わず、次の状態と操作を理解できる。ログイン方法は、利用可能な認証情報から一貫して確認できる。

## 対象ユーザーと利用シーン

- 対象ユーザー: Savingsに認証済みで、自分の設定を確認・変更するユーザー。
- 保存結果の確認: 表示名を保存したあと、保存済みの値として確定したかを判断したい。
- 取得失敗からの復帰: プロフィール情報の取得に失敗したあと、Retryで再試行し、キーボード操作を継続したい。
- 設定の継続利用: プロフィール情報がloadingまたはerrorでも、言語設定を変更したい。
- ログイン方法の確認: 表示元の認証メタデータに不足があっても、現在のログイン方法を判断したい。

## ユーザーストーリー

- 認証済みユーザーとして、保存結果が再取得まで確認できない場合は、未確定状態として理解したい。
- キーボード利用者として、Retry後にfocusを失わず、再試行結果を確認したい。
- 認証済みユーザーとして、プロフィール情報の取得状態に関係なく言語設定を使いたい。
- 認証済みユーザーとして、表示元のメタデータに不足があってもログイン方法を確認したい。

## スコープ

### 対象

- 表示名保存後のsource of truth再取得が成功するまで、保存成功・完了状態を確定しないこと。
- 認証中のユーザーに対応するプロフィール1件の更新を確認し、対象なしを成功扱いしないこと。
- 再取得に依存する保存操作で、送信中の主操作をloading / disabledとして扱うこと。
- mutation成功後の再取得失敗を、保存成功として表示しないこと。
- プロフィール情報の取得失敗からRetryしたとき、focusを失わせないこと。
- プロフィールのloading/error状態でも、LanguageSelectを操作できること。
- `app_metadata.provider` がない場合に `identities[0].provider` をログイン方法表示のfallbackとして扱うこと。
- Settingsの操作群配置は、画面の視線の流れを踏まえてDesignで判断し、左寄せを採用する場合は理由を明示すること。

### 対象外

- メールアドレスの変更。
- ログイン方法の追加、変更、連携解除、再認証。
- アカウント削除。
- 言語設定の仕様変更。
- 表示名以外のプロフィール情報の更新。
- DBスキーマ、API契約、認証方式・設定、権限モデル、RLSの変更を前提にすること。
- 具体的なcomponent、hook、API名、レイアウト、表示順、最終文言、実装手順をRequirementsで固定すること。
- 既存のRequirements / Design Docの編集。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/1552-profile-account-edit-follow-up/requirements.md`, `apps/web/**`
  - domain: `user`, `auth`, `web`
  - activity: `design_screen`, `change_form`, `change_user_behavior`, `review_test_gap`
  - topic: `user`, `auth`, `ui`, `react-query`, `test`, `error-boundary`
- Selected nodes:
  - `domain.user` -> `docs/harness/domain/user.md`: Auth userとアプリ内ユーザーの責務、表示名の更新可能範囲、更新対象の成功判定を確認するため。
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`: Settingsの操作群配置、フォーム状態、loading中の操作状態を確認するため。
  - `web.query-cache` -> `apps/web/docs/policies/query-cache.md`: mutation後のsource of truth再取得と成功表示の境界を確認するため。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: 保存中状態と再取得失敗の回帰テスト方針を確認するため。
  - `web.suspense-boundaries` -> `apps/web/docs/policies/suspense-boundaries.md`: loading/error状態と再試行からの復帰条件を確認するため。
- Depends-on nodes: `web.suspense-boundaries`の`web.query-cache` / `web.test-policy`は上記選択済み。追加の依存文書はない。
- Conflict decision: none。

## Domain Value Intent

| 値 | ユーザーが判断したいこと | Requirements上の境界 |
| --- | --- | --- |
| 表示名 (`name`) | アプリ内で自分がどの名前として表示されるか、変更が確定したか | 表示用プロフィール値として確認・編集する。本人確認、認証、権限判定には使わない。 |
| 登録メールアドレス | 現在ログインしているアカウントを識別できるか | 確認する読み取り専用値。変更や同期処理は対象外。 |
| ログイン方法 / provider | どの認証方法でログインしているか | 現在の方法を識別する。`app_metadata.provider`がなければ`identities[0].provider`をfallback候補とする。認証方法の変更は対象外。 |
| loading / error / 保存状態 | いま確認・保存・再試行できる状態か | 成功、未確定、失敗、次の操作を混同させない。 |

具体的な表示順、レイアウト、コンポーネント、表示文言はDesign / Planで決める。

## 機能要件

### FR-1: 保存結果を確定して表示する

- 表示名の更新が成功しても、source of truthの再取得が成功するまで保存成功・完了状態を確定しない。
- invalidationの完了だけを再取得成功とみなさない。
- 再取得に失敗した場合は、ユーザーが保存成功と誤認しない状態にし、必要な次の行動を理解できるようにする。
- 認証中のユーザーに対応するプロフィール1件が更新されたことを確認する。対象が見つからない場合は成功として扱わない。
- 保存中は主操作をloading / disabledとして扱い、多重保存を防ぐ。

### FR-2: Retry後のキーボード操作を継続できる

- プロフィール情報の取得失敗時にRetryを実行できる。
- Retry開始から結果が確定するまで、Retry操作の状態をユーザーが理解できる。
- Retry後もキーボード利用者がfocusを失わず、再試行結果と次に取れる操作を確認できる。
- Retry後にエラー状態が継続する場合と、情報表示へ復帰する場合のfocus方針は、上記要件を満たす形でDesign / Planに定義する。

### FR-3: プロフィール状態とLanguageSelectを共存させる

- プロフィール情報のloading中でも、LanguageSelectを不必要に操作不能にしない。
- プロフィール情報の取得error中でも、LanguageSelectを操作できる。
- プロフィール情報の失敗表示やRetryが、言語設定の値・保存・仕様を壊さない。

### FR-4: ログイン方法のprovider fallbackを扱う

- `app_metadata.provider` が存在する場合は、その値をログイン方法の確認に利用できる。
- `app_metadata.provider` がない場合で `identities[0].provider` が存在する場合は、その値をfallbackとして利用できる。
- 両方から確認できない場合は、存在しないproviderを成功値として表示しない。ユーザーが確認できない状態と次の行動を理解できる形はDesign / Planで定義する。
- provider fallbackは表示上の確認に限り、認証方法の追加・変更・連携解除を行わない。

## 非機能要件と制約

- 認証済みユーザー自身のプロフィールだけを扱い、別ユーザーの値や未確定値を成功済みの現在値として表示しない。
- 状態表示と操作要素を混同させない。
- エラーは色だけに依存せず、ユーザーが失敗理由と次の行動を理解できる状態にする。
- キーボード利用者がRetry後にfocusを失わない。
- 既存の言語設定をプロフィール情報の状態表示から独立して利用できる。
- 新規依存、DBスキーマ変更、API契約変更、認証方式・設定変更、権限モデル変更をこのRequirementsの前提にしない。
- Issue #1552、Learn入力、selected refsから追跡できない要求を追加しない。

## 受け入れ条件

- AC-1: 表示名保存後、source of truthの再取得が成功するまで保存成功・完了状態を表示しない。
- AC-2: mutationが成功しても再取得に失敗した場合、ユーザーが保存成功と誤認する通知・状態にならない。
- AC-3: 認証中のユーザーに対応するプロフィール1件が更新されたことを確認し、対象なしを成功として扱わない。
- AC-4: 保存中は主操作がloading / disabledとなり、多重保存を開始できない。
- AC-5: プロフィール取得errorからRetryしたキーボード利用者が、Retry後にfocusを失わず、結果と次の操作を確認できる。
- AC-6: プロフィール情報がloading中でもLanguageSelectを操作できる。
- AC-7: プロフィール情報がerror中でもLanguageSelectを操作でき、言語設定の仕様は変わらない。
- AC-8: `app_metadata.provider` がない場合、`identities[0].provider` があればログイン方法の確認に利用できる。
- AC-9: provider情報が確認できない場合、存在しないproviderを現在値として表示しない。
- AC-10: emailの変更、ログイン方法の変更、アカウント削除、言語設定の仕様変更を追加しない。
- AC-11: Requirements / PRDが選択したrule-mapサブグラフに違反しないことを確認できる。

## Q&Aログ

- Q: これはIssue #1552の対象機能を広げる要求か？
  - A: 広げない。プロフィール情報の確認、表示名編集、既存の言語設定維持という境界の中で、状態表示・復帰・provider確認の不足を明確化する。
- Q: Retry後のfocusを常に同じボタンへ戻すのか？
  - A: Requirementsでは、キーボード利用者がfocusを失わず結果と次の操作を確認できることを要求する。Retryが表示され続ける場合と成功して表示が切り替わる場合の具体的なfocus先はDesign / Planで決める。
- Q: loading/error中はプロフィール画面全体を操作不能にしてよいか？
  - A: LanguageSelectは操作できる必要がある。プロフィール情報の状態に無関係な既存操作まで不必要に停止しない。
- Q: provider fallbackはログイン方法の変更を意味するか？
  - A: 意味しない。確認用の表示値を補完するだけで、認証設定や連携状態は変更しない。
- Q: 再取得失敗時に保存成功通知を出してよいか？
  - A: 出してはいけない。source of truthの再取得成功まで成功・完了状態を確定しない。
- Q: 対象プロフィールが0件の更新結果を成功として扱えるか？
  - A: 扱えない。認証中のユーザーに対応する1件の更新確認が必要である。

## 技術的考慮事項

- 後続Design / Planでは、source of truthの再取得失敗を成功通知へ伝播させない責務境界、更新対象1件の確認方法、Retry後のfocus先、LanguageSelectとの状態境界、provider値の表示方針を決める。
- API通信を伴う回帰テストでは、実際のコンポーネント操作とAPI境界を通して、保存中状態・再取得失敗・loading/error中のLanguageSelect操作・provider fallbackを確認する。
- Requirementsでは、具体的なquery API、hook、component、API名、mock実装、レイアウトを指定しない。
- Settingsの操作群を左寄せにする場合は、視線の流れと操作対象のまとまりを理由としてDesignに残す。Requirementsでは配置を固定しない。

## Verification

この成果物はdocumentation-onlyのRequirements / PRDであり、アプリのformat、lint、typecheck、testは実行しない。次を手動確認する。

- Issue #1552の意図、対象外、制約、成功条件、Stop条件から要求が追跡できる。
- Learnで整理した3つのTask Contextと、更新済みの正本ルールが要件・受け入れ条件に反映されている。
- 現在の課題と将来の要求が混同されていない。
- Domain Value Intentが表示名、email、provider、状態について整理されている。
- 具体的なUI形状、実装方式、API名、スコープ外のデータ変更をRequirementsで決めていない。
- 既存の `docs/ai-driven-development/workspaces/1552-profile-account-edit/requirements.md` と `design-doc.md`、実装ファイルを変更していない。
- `git diff --check` が成功する。

## Stop条件

- Issue #1552、Learn入力、selected refsから追跡できない要求を追加する必要がある。
- Retry後のfocus、LanguageSelectとの共存、provider fallbackの意図が複数解釈になり、Requirementsで境界を保てない。
- Auth userとアプリ内ユーザーの責務、または表示名の更新可能範囲と矛盾する。
- emailやログイン方法の更新、DBスキーマ変更、API契約変更、認証方式・設定変更、権限モデル変更、RLS変更が必要になる。
- Requirementsがselected rule-map subgraphに違反する、または適用範囲が曖昧で解消できない。

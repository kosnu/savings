---
title: "Requirements / PRD: 言語設定をアカウントに保存して端末間で同期する"
doc_type: requirements
status: draft
area: repository
applies_to:
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - requirements
  - language
  - profile
  - user
  - auth
when_to_read:
  - Issue #1563 の言語設定同期要求を確認するとき
  - アカウント設定と端末内言語設定の優先順位を設計するとき
---

# Requirements / PRD: 言語設定をアカウントに保存して端末間で同期する

## 背景と課題

現在の言語設定はブラウザの `localStorage` に保存されるため、同じユーザーでも端末やブラウザごとに選択言語が分かれる。認証済みユーザーが選択した言語をアカウント設定として保持し、別端末でログインしたときにも同じ言語を利用できる状態が必要である。

Issue #1563 は、`public.users.language` を永続的な保存先とし、本人が更新できるプロフィール列を既存の `name` に `language` だけ加えることを監督入力として明示している。ブラウザ内の値は起動時のfallbackまたはcacheとして利用できるが、認証済みユーザーが明示的に保存した言語のsource of truthにはしない。

## Current State / Current Gaps

- 対応言語は `en` と `ja` である。
- i18n初期化は `localStorage` の `appLanguage` を読み、未設定または利用不能なら `en` を使う。
- 言語変更イベントは選択言語を `localStorage` に保存する。
- 言語選択UIは現在、設定のAppearance領域でi18nの言語を直接変更する。
- `public.users` とWeb側のDatabase型、プロフィール取得・更新境界には `language` がない。
- 現行の正本ルールとDB列権限は、クライアントが更新できるプロフィール列を `name` のみに限定している。
- 保存済みアカウント言語、未設定、取得失敗、保存失敗を区別する契約がない。

## Future Behavior

認証済みユーザーが明示的に選択した言語は自分の `public.users.language` に保存され、保存済み値がある場合は端末内の値より優先される。別端末や別ブラウザでも、認証後に同じアカウント言語が反映される。

アカウント言語が未設定の場合は、有効な端末内言語、なければ既定言語を利用できる。ただし、そのfallback値をユーザーの選択と推測してアカウントへ自動保存しない。取得失敗時もアプリは端末内言語または既定言語で利用可能なままとし、fallbackを取得済みアカウント値として扱わない。

言語変更はアカウント保存の成否を伴う操作として扱う。保存に失敗した選択を、保存済みのアカウント言語またはブラウザだけの永続値として確定しない。

## 対象ユーザーと利用シーン

- 対象ユーザー: Savingsに認証済みで、設定画面から日本語または英語を選択するユーザー。
- 同一端末: 保存済みのアカウント言語で継続利用したい。
- 別端末: 同じアカウントでログインし、前に保存した言語を引き継ぎたい。
- 既存ユーザー: アカウント言語が未設定でも、現在の端末内言語で利用を継続したい。
- 障害時: 取得失敗で利用不能にならず、保存失敗を成功と誤認したくない。

## ユーザーストーリー

- 認証済みユーザーとして、選択した言語をアカウントに保存したい。そうすることで端末を替えても同じ言語を使える。
- 認証済みユーザーとして、ログイン後に保存済み言語を自動的に利用したい。そうすることで端末ごとに設定し直さずに済む。
- 既存ユーザーとして、保存済み言語がなくても現在の言語で利用を継続したい。そうすることで移行時に推測値を強制されない。
- 認証済みユーザーとして、言語の取得・保存に失敗したことを理解したい。そうすることで端末内fallbackと保存済み値を誤認しない。

## スコープ

### 対象

- `public.users.language` の永続的な所有責務。
- 本人の `language` だけを更新できるプロフィール更新境界。
- 認証後の言語取得と適用。
- 明示的な言語変更時の保存。
- アカウント言語、端末内言語、既定言語の優先順位。
- 未設定、取得中、取得失敗、保存中、保存成功、保存失敗の状態。
- DB migration、型・API境界、列権限・RLS・更新条件、正本ユーザールール、回帰テストの同期。
- 既存の日本語・英語表示の回帰防止。

### 対象外

- 対応言語の追加または翻訳方針の変更。
- テーマ設定のアカウント同期。
- 未認証ユーザー向けアカウント設定。
- `name` と `language` 以外のプロフィール列の更新許可。
- email、認証方式、本人確認情報、権限の変更。
- 言語選択画面の新設や設定ナビゲーションの変更。
- このGoalでのDesign Doc作成、実装、commit、push、PR作成。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `requirements.md`, `apps/web/**`, `apps/api/**`
  - domain: `ai-driven-development`, `user`, `auth`, `database`, `web`
  - activity: `write_prd`, `change_user_behavior`, `change_auth_assumption`, `change_database`
  - topic: `requirements`, `language`, `user`, `auth`, `database`
- Selected:
  - `ai-driven.overview`: Requirements、Design、Build、Shipの責務を分離するため。
  - `ai-driven.workflow`: Intent / Requirementsの成果物、Done、Stop、後続工程境界を守るため。
  - `ai-driven.issue-guidelines`: 更新済みIssueを意図・境界・監督入力として展開するため。
  - `ai-driven.goal-templates`: Requirementsの必須要素と検証観点を満たすため。
  - `architecture.overview`: WebとSupabase APIの役割分担を確認するため。
  - `infrastructure.overview`: Supabase AuthとPostgreSQLを利用する前提を確認するため。
  - `domain.user`: Auth user、`public.users`、本人行、更新対象1件、更新可能プロフィール列の契約を扱うため。
- Depends-on:
  - `ai-driven.workflow` の前提として `ai-driven.overview`。
  - `ai-driven.issue-guidelines` と `ai-driven.goal-templates` の前提として `ai-driven.workflow`。
  - `infrastructure.overview` の前提として `architecture.overview`。
- Conflict decision: `domain.user` の「更新可能列は `name` のみ」は、最新Issueで明示された監督入力により `name` と `language` へ限定拡張する変更対象とする。本人行・更新対象1件・他列更新禁止の既存契約は維持する。

## Domain Value Intent

| 値・状態 | ユーザーが判断したいこと | Requirements上の境界 |
| --- | --- | --- |
| `public.users.language` | アカウントにどの言語が保存されているか | `en`、`ja`、未設定のいずれか。認証済み本人の永続的source of truthとする。 |
| 端末内言語 | account未設定または取得失敗時に何語で利用するか | 有効な `en` / `ja` のfallbackまたはcache。保存済みaccount値とは区別する。 |
| 既定言語 | account値と有効な端末値がない場合に利用できるか | 現行の `en` を維持し、accountへ自動保存しない。 |
| 取得状態 | account値を確認できたか | loading、success(set/unset)、failureを区別し、fallbackを取得成功と見せない。 |
| 保存状態 | 選択がaccountへ確定したか | pending、success、failureを区別し、failureをブラウザだけの成功として扱わない。 |

具体的なコンポーネント、通信順序、optimistic updateの有無、最終文言はDesign / Planで決める。Requirementsではsource of truthとユーザーが判断できる状態だけを固定する。

## 機能要件

### FR-1: アカウント言語を永続化する

- `public.users.language` は認証済みユーザーの言語設定を所有する。
- 保存できる値は既存対応言語の `en` と `ja` に限り、未設定を表現できる。
- 既存ユーザーの値を端末、browser locale、既定言語から推測してmigrationまたはログイン時に自動保存しない。

### FR-2: 更新境界を `language` に限って拡張する

- 認証済みユーザーは自分の `language` を更新できる。
- クライアントが更新できるプロフィール列は `name` と `language` のみとし、email、`auth_user_id`、その他の列を更新可能にしない。
- 更新は認証中ユーザーに対応する本人行1件だけを対象とし、対象がない、複数、または更新後の値を確認できない場合を成功として扱わない。
- DB列権限、RLS、更新条件、Webの型・API境界、正本ユーザールールを同じ契約へ同期する。

### FR-3: 保存済みアカウント言語を優先する

- 認証後にアカウント言語を取得する。
- 有効な保存済みアカウント言語がある場合、端末内言語より優先して現在言語へ反映する。
- 保存済み言語は別端末または別ブラウザでも同じアカウントに反映される。
- 端末内保存を維持する場合はaccount値のcacheとして同期できるが、accountと競合するsource of truthにしない。

### FR-4: アカウント言語未設定時のfallbackを定義する

- アカウント言語が未設定の場合、有効な端末内言語を利用し、なければ既定言語 `en` を利用する。
- fallback値はユーザーがaccount保存を明示した値ではないため、自動で `public.users.language` へ書き込まない。
- ユーザーが明示的に言語を選択して保存に成功した時点で、その値をaccountのsource of truthとする。

### FR-5: 取得失敗でも利用を継続できる

- アカウント言語の取得中は、未確認のaccount値を確定済みとして扱わない。
- 取得に失敗しても、有効な端末内言語または既定言語でアプリを利用できる。
- 取得失敗をユーザーが理解でき、fallback言語を保存済みaccount値として表示しない。
- 取得失敗だけを根拠に、言語の再試行、画面遷移、取消など新しい操作を追加する要求にはしない。

### FR-6: 言語変更の保存結果を確定する

- 認証済みユーザーによる明示的な言語変更は、本人の `public.users.language` の保存と一つのユーザー操作として扱う。
- 保存中はaccountへ確定していないことが区別でき、重複する変更を確定済みとして扱わない。
- 保存成功時だけ、選択言語を保存済みaccount値として確定し、端末内cacheを使う場合は同じ値へ同期する。
- 保存失敗時は成功表示をせず、失敗した選択をブラウザだけの永続値として残さない。現在言語は最後に確認できたaccount値、または変更前のfallbackへ整合させる。
- 保存失敗理由をユーザーが理解できる状態にするが、このRequirementsは新しいRetry操作を要求しない。

### FR-7: 既存言語機能を維持する

- 対応言語、翻訳resource、locale対応、既定言語は既存の日本語・英語の範囲を維持する。
- account同期の追加によって、日付表示や既存画面の言語切り替えを壊さない。
- テーマ、他プロフィール項目、未認証ユーザーの設定挙動を変更しない。

## 非機能要件と制約

- account言語の取得失敗をアプリ全体の利用不能へ拡大しない。
- account値、fallback値、未確認値、保存失敗値を同じ確定状態として扱わない。
- 言語値はDB、API response、client入力の各境界で `en` / `ja` / 未設定に制限する。
- 本人以外の `public.users` 行を取得・更新できない既存の認可境界を維持する。
- 認証済みクライアントの列更新権限を `name` と `language` より広げない。
- ブラウザストレージが利用不能でも、メモリ上の言語表示とアプリ利用を継続できる既存耐障害性を維持する。
- 新規依存、対応言語追加、翻訳方式変更を前提にしない。

## 受け入れ条件

- AC-1: 認証済みユーザーが `ja` または `en` を選択して保存すると、自分の `public.users.language` に同じ値が保存される。
- AC-2: 保存済みaccount言語がある状態で別端末または別ブラウザからログインすると、その言語が端末内言語より優先して反映される。
- AC-3: account言語が未設定で有効な端末内言語がある場合、その言語で利用できるがaccountへ自動保存されない。
- AC-4: account言語と有効な端末内言語がない場合、既定言語 `en` で利用できるがaccountへ自動保存されない。
- AC-5: account言語の取得に失敗してもfallback言語で利用でき、取得成功や保存済みaccount値として誤認されない。
- AC-6: 言語保存に失敗した場合は成功表示にならず、失敗した選択がブラウザだけの永続値として残らない。
- AC-7: authenticated roleの更新可能列は `name` と `language` に限られ、他のプロフィール列は更新できない。
- AC-8: language更新は認証中の本人行1件だけを成功対象とし、対象行が確認できない場合は失敗する。
- AC-9: 既存ユーザーのmigrationでlanguageを推測・強制設定しない。
- AC-10: DB schema、生成型、取得・更新API、RLS・列権限・更新条件、MSW/API回帰テスト、正本ユーザールールが `name` / `language` 契約へ同期される。
- AC-11: 既存の日本語・英語表示、言語切り替え、locale依存表示、テーマ、他プロフィール項目が壊れていない。

## Q&Aログ

- Q: 言語設定の永続的な所有先はどこか？
  - A: 最新Issueの監督入力どおり `public.users.language` とする。
- Q: account値と端末内値のどちらを優先するか？
  - A: 有効な保存済みaccount値を優先する。account未設定または取得失敗時だけ端末内値、次に既定値をfallbackとして使う。
- Q: 既存ユーザーのlanguageをbrowser localeやlocalStorageからbackfillするか？
  - A: しない。未設定を維持し、ユーザーの明示的な保存で初めてaccount値を確定する。
- Q: localStorageを廃止するか？
  - A: source of truthにはしない。account未設定・取得失敗時のfallbackや、保存成功後のcacheとして維持するかはDesign / Planで決められる。
- Q: 保存失敗時に選択言語だけを端末へ残すか？
  - A: 残さない。account保存の失敗をbrowser-onlyの成功へ分岐させず、最後に確認できたaccount値または変更前fallbackへ整合させる。
- Q: client update権限をプロフィール全体へ広げるか？
  - A: 広げない。既存の `name` と今回追加する `language` に限る。
- Q: 取得・保存失敗時にRetry操作を追加するか？
  - A: このRequirementsでは追加しない。失敗状態を理解できることを要求し、具体的な再試行境界は明示された既存操作の範囲でDesign / Planが扱う。

## 技術的考慮事項

- Current Stateの根拠は `apps/web/src/i18n/index.ts`、`apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.tsx`、`apps/web/src/types/database.types.ts`、プロフィール取得・更新実装にある。
- 現行の列権限とRLSは `apps/api/supabase/migrations/20260621000000_link_users_to_auth_users.sql`、正本契約は `docs/harness/domain/user.md` にある。
- 後続Design / Planでは、nullableなlanguage列の制約、列権限、updated_at更新条件、取得・更新API責務、authenticated app初期化との接続、保存中/失敗状態、cache同期順序、テスト境界を決める。
- `domain.user` の更新可能列ルールは、Build / Verify完了までに `name` と `language` へ限定拡張し、他の既存ルールを維持する必要がある。
- Web application codeを変更するBuild / Verifyでは、AGENTS.mdのWeb verification batchを実行する。DB migrationに専用verification commandは現時点で定義されていないため、SQL差分・生成型・Web統合境界を確認する。

## Verification

この成果物はRequirements / PRDであり、application verification commandsは実行しない。次を手動確認する。

- Issue #1563の背景、対象、対象外、制約、成功条件、更新済み監督入力から全要求を追跡できる。
- account、端末内、既定言語の優先順位と、未設定・取得失敗・保存失敗が一意に定義されている。
- `name` / `language` 以外の更新、対応言語追加、テーマ同期、未認証account設定を追加していない。
- `domain.user` の変更対象と維持する契約が区別されている。
- 実装ファイル、通信順序、UI形状をRequirementsで固定しすぎていない。

## Stop条件

- `public.users.language` 以外の所有先、または `name` / `language` 以外のプロフィール更新が必要になる。
- 対応言語、翻訳方針、テーマ、未認証ユーザーのaccount設定を変更する必要がある。
- account優先、未設定、取得失敗、保存失敗の境界をこのRequirementsと矛盾する形へ変更する必要がある。
- 本人行1件と列限定更新を維持できない。
- Issue #1563、監督入力、selected refsから追跡できない要求や成功条件が必要になる。
- selected rule-map subgraphと解消不能な矛盾がある。

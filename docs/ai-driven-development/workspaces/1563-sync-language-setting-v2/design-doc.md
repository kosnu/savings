---
title: "Design Doc: 初期言語を認証同期で登録する"
doc_type: design
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - design
  - user
  - auth
  - language
  - supabase
---

# Design Doc: 初期言語を認証同期で登録する

## 目的

[Requirements](./requirements.md)をread-only入力とし、既存のIssue #1563実装へ、新規ユーザーの初期言語を`navigator.languages`から決めて`public.users.language`へ登録する差分を追加する。既存ユーザー、未対応言語だけの候補、既存の言語取得・変更UIには新しい推測や操作を加えない。

## Current Stateと原因境界

- 既存実装は`public.users.language`、本人行の取得・更新、DB確認後のi18n/`localStorage`同期を備える。
- `ensure_authenticated_user(p_initial_display_name)`は新規の`public.users`行を作成するが、`language`をinsertしないため、新規行も必ず未設定から始まる。
- `SupabaseSessionProvider`は認証同期RPCへ表示名だけを渡し、ブラウザの言語候補を取得していない。
- `LanguagePreferenceSync`はDB値が未設定なら現在の端末内言語を維持し、自動保存しない。これは既存ユーザーへの推測保存を防ぐ境界として維持する。
- 報告された「言語を設定しても弾かれる」現象の直接原因は、会話情報だけでは確定していない。今回の変更は、決定済みの初期登録規則に追跡できる新規ユーザーの未設定発生を解消し、別原因を推測修正しない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/i18n/**`, `apps/web/src/providers/supabase/**`, `apps/web/src/types/database.types.ts`, `apps/api/supabase/migrations/**`
  - domain: `user`, `auth`
  - activity: `change_database`, `change_api`, `change_user_behavior`, `add_test`
  - topic: `language`, `rpc`, `transaction`, `supabase`
- Selected nodes:
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: DesignとBuildの成果物境界を守るため。
  - `domain.user` -> `docs/harness/domain/user.md`: 初期候補、DB正本、既存値非上書きを守るため。
  - `policy.transaction-boundaries` -> `docs/harness/policies/transaction-boundaries.md`: ユーザー作成と初期言語保存を同一操作にするため。
  - `infrastructure.overview` -> `docs/infrastructure.md`: Web、Supabase Auth、PostgreSQLの境界を確認するため。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: browser API、RPC入力、状態境界の回帰テストを決めるため。
  - `web.query-cache` -> `apps/web/docs/policies/query-cache.md`: 既存のDB正本とquery同期を維持するため。
- Depends-on nodes:
  - `ai-driven.overview` -> `docs/ai-driven-development/overview.md`。
  - `architecture.overview` -> `docs/architecture.md`。
- Conflict decision: none。DB/API変更はIssueとRequirementsで明示された範囲内にあり、更新可能列は`name`と`language`から広げない。

## 採用する設計

### 1. Webが初期候補の選択を所有する

`apps/web/src/i18n/index.ts`へ、言語タグの配列から最初の対応言語を返す純粋関数を追加する。

- 入力順を保って1件ずつ評価する。
- 大文字小文字を区別せず、`ja`または`ja-*`を`ja`、`en`または`en-*`を`en`へ正規化する。
- 未対応タグは次の候補へ進む。
- 対応候補がなければ`null`を返す。既定`en`へ変換しない。
- `navigator.languages`は`SupabaseSessionProvider`が認証済みsessionを検証するときに1回読み、正規化済み値だけをRPCへ渡す。

ブラウザ固有の入力順と正規化はアプリケーション体験のルールであるためWebが所有し、DB関数で言語タグ解釈を重複実装しない。

### 2. 認証同期RPCの入力契約を拡張する

`ensureAuthenticatedUser`を`(initialDisplayName, initialLanguage)`へ拡張し、RPCへ次を渡す。

- `p_initial_display_name`: 既存どおり正規化済み表示名。
- `p_initial_language`: `en`、`ja`、`null`のいずれか。

generated Database型の`ensure_authenticated_user.Args`も同じ契約へ同期する。Supabase JavaScriptのparameter付きRPC契約に沿い、引数名をDB関数と一致させる。

### 3. 新しいmigrationでDB関数を置き換える

Supabase CLIの`migration new`で新規migrationを作成し、既にPRへ含まれるmigration履歴を編集しない。そのmigrationで次を行う。

- 旧signature `public.ensure_authenticated_user(text)`をdropする。
- `public.ensure_authenticated_user(text, text)`を作成する。
- `p_initial_language`がnon-nullの場合は`en`または`ja`だけを許可し、それ以外は例外にする。
- 既存の認証ID・email検証、既存行検索、email衝突処理を維持する。
- `auth_user_id`に対応する行が既にある場合は、languageの値にかかわらず即returnし、更新しない。
- 新規行のinsert列を`(auth_user_id, name, email, language)`とし、ユーザー作成と初期言語保存を同じDB function transactionで実行する。
- `security definer set search_path = ''`、全relationのschema qualification、`auth.uid()`確認を維持する。
- `PUBLIC`と`anon`からexecuteをrevokeし、新signatureだけを`authenticated`へgrantする。

このRPCは既存のアプリ内ユーザー作成境界を保ち、クライアントによる直接insertは追加しない。

### 4. 既存同期とUIは変更しない

- `LanguagePreferenceSync`はDB値がnon-nullなら適用し、nullなら端末内言語を維持する現在の挙動を保つ。
- `LanguageSelect`のDB確認後保存、失敗通知、`localStorage`同期を変更しない。
- 既存ユーザーのnull値をlogin時に補完しない。
- 新しい表示文言、選択UI、Retry、通知を追加しない。

## Transactionとデータ境界

| 操作 | 実行境界 | 原子性・非上書き |
| --- | --- | --- |
| 新規アプリ内ユーザー作成 | `ensure_authenticated_user` RPC | `users` insertに初期言語を含め、片方だけの成功を作らない。 |
| 既存ユーザーの認証同期 | 同RPCの既存行早期return | browser候補を既存DB値へ書かない。 |
| 明示的な言語変更 | 既存PostgREST update + refetch | 既存実装を維持し、DB確認後だけUIへ反映する。 |

DB check constraintは保存可能値を守り、Webの候補選択関数はブラウザ言語タグの解釈を所有する。

## 変更対象

- `apps/web/src/i18n/index.ts`: 対応言語候補の順序付き選択関数。
- `apps/web/src/i18n/index.test.ts`: 順序、地域タグ、大文字小文字、未対応のみ、空配列。
- `apps/web/src/providers/supabase/SupabaseSessionProvider.tsx`: `navigator.languages`から候補を取得してRPCへ渡す。
- `apps/web/src/providers/supabase/SupabaseSessionProvider.test.tsx`: 認証同期へ初期言語候補が渡ること。
- `apps/web/src/providers/supabase/ensureAuthenticatedUser.ts`: nullable初期言語のRPC parameter。
- `apps/web/src/providers/supabase/ensureAuthenticatedUser.test.ts`: RPC引数契約とerror伝播。
- `apps/web/src/types/database.types.ts`: DB function Args。
- `apps/api/supabase/migrations/<generated>_initialize_user_language.sql`: function signature、validation、insert、権限。
- `docs/ai-driven-development/workspaces/1563-sync-language-setting-v2/design-doc.md`: 本設計。

## 対象外ファイル

- `apps/web/src/features/preferences/languagePreference/**`
- `apps/web/src/features/preferences/appearanceSettings/**`
- `apps/web/src/i18n/resources.ts`
- `apps/api/supabase/migrations/20260802000000_add_user_language.sql`
- `docs/harness/domain/user.md`
- 現在サイクルの`requirements.md`

既存実装または正本ルールの変更が不要なため、これらを再編集しない。

## テスト方針

| Requirements | 回帰テスト・確認 |
| --- | --- |
| AC-1 | i18n unitで`[fr-FR, ja-JP, en-US] -> ja`、session testでRPCへ`ja`を渡す。 |
| AC-2 | i18n unitで`[en-GB, ja-JP] -> en`。 |
| AC-3 | 未対応のみ・空配列で`null`、RPCへ`null`を渡す。migrationにfallback/defaultを置かない。 |
| AC-4 | migrationの既存行早期returnがinsertより前にあり、update文がないことをdiff確認する。 |
| AC-5〜AC-10 | 既存languagePreference、AppearanceSettings、provider testsを含むWeb全unit/integration batchを実行する。 |

API通信の追加境界は`ensureAuthenticatedUser.test.ts`で実際のSupabase client mockに対するRPC名・parameterを確認する。DB専用検証commandはリポジトリに定義されていないため、migrationのSQL contractとWeb生成型を照合する。

## 採用しない案

| 案 | 理由 |
| --- | --- |
| `navigator.language`だけを使う | 後続候補から最初の対応言語を選ぶ決定を満たさない。 |
| `toAppLanguage`を候補選択へそのまま使う | 現行関数は未対応値も`en`へ変換し、後続の`ja`候補を見落とす。 |
| DB関数でBCP 47タグを解釈する | ブラウザ固有ルールをDBへ重複させる。 |
| 新規作成後にlanguageを別PATCHする | ユーザー作成だけ成功する中間状態を作る。 |
| 既存ユーザーのnullをlogin時に補完する | 既存ユーザーへ推測値を強制保存しない制約に反する。 |
| 対応候補なしを`en`にする | fallbackは未決定でありRequirements外。 |
| 既存の言語設定UI・queryを再設計する | 今回の決定済み差分に不要。 |

## 既存挙動への影響

- 新規ユーザーだけが、対応するbrowser候補をDB初期値として持つ。
- 既存ユーザーはDB値が`en`、`ja`、nullのいずれでも変更されない。
- 対応候補なしでは従来どおりDB未設定となる。
- 保存済み言語の端末間同期、明示変更、失敗通知、テーマ、プロフィール表示名は変更しない。
- RPC signatureが変わるため、migrationとWeb clientを同時に配布する必要がある。旧clientと新DBの混在期間はRPC呼び出しが失敗し得るため、PRのmigrationとWebを同一release単位で適用する。

## リスクと確認事項

- `navigator.languages`が空または未対応のみの場合、DB未設定の体験は残る。これは未決定fallbackを発明しないための意図した境界であり、今回のStopではない。
- 報告された保存拒否がmigration未適用、RLS、環境差など別原因の場合、この差分だけでは解消しない。現在の会話に根拠がないため推測修正せず、既存回帰テストで保存経路を守る。
- function signature変更はAPI契約変更だが、IssueとRequirementsが許可している。権限grantの対象signatureを誤らないようSQLを確認する。
- 2026-08-02のSupabase changelogには本件へ適用が必要なbreaking changeはない。公式Database Functions guidanceに従い、parameter名、empty search path、execute権限を維持する。

## Verification

Designはdocumentation-onlyのためapplication commandを実行しない。

- RequirementsのACとテスト方針を照合する。
- 現在サイクルのRequirementsを変更していないことを確認する。
- `git diff --check`を実行する。

## Stop条件

- 既存ユーザーの値変更または対応候補なしのfallbackが必要になる。
- 既存RPCでユーザー作成と初期言語保存の原子性を保てない。
- `name`と`language`以外の更新権限変更が必要になる。
- 既存のlanguagePreference UI/queryを変更しないと必須条件を満たせない。
- selected ruleまたは公式Supabase function契約と矛盾する。

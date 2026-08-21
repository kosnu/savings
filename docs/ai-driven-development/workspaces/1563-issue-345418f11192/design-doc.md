---
title: "Design Doc: 言語設定をアカウントに保存して端末間で同期する"
doc_type: design-doc
status: proposed
area: web
applies_to:
  - apps/web
  - apps/api
topics:
  - user
  - auth
  - language
  - synchronization
  - database
when_to_read:
  - Issue #1563の言語設定同期を実装または検証するとき
---

## 入力と前提

- Requirements canonical source: `docs/ai-driven-development/workspaces/1563-issue-345418f11192/requirements.json`
- Requirements SHA-256: `c43d7a9a1ee41753fe5bf51ad7653f6bd8e95ebd6214c0dd669a8c1ced2b879f`
- Requirements Input Gate / Completeness Gate: artifact検証成功。
- Git `HEAD`の同workspace Design baseline: なし。
- Requirementsと生成requirements.mdはread-onlyとし、BuildはこのDesignのreceiptを上流identityとして扱う。

## Rule Selection

- Direct/selected: `domain.user`。public.users.languageをアカウント所有・認証境界のユーザードメインとして設計する。
- Dependency closure: なし。
- Conflict decision: 既存のprofile update allowlistはlanguage追加範囲だけを拡張し、他の列へ広げない。

## 採用する構成

### 永続化とAPI

`public.users.language`を既存の言語値と同じ型制約で追加し、Supabase migration、生成型、プロフィール取得・更新APIの順に同期する。更新RPCまたは既存mutationは認証済みの自身の行だけを対象にし、RLSとサーバー側allowlistで二重に境界を守る。

### Web状態

ログイン時はアカウント値を取得してlanguage stateを初期化し、selector変更は既存のlocalStorage書き込みとアカウントmutationを同一の状態遷移として扱う。サーバー値が存在する場合を優先し、未設定時だけ既存端末値、最後に安全な既定言語へ進む。

## データ・API境界

- migrationは`public.users.language`をnullableな既存互換値として追加し、対応値を日本語・英語へ限定する。
- profile updateの入力schemaとAPI型は`name`と`language`だけを更新可能列として明示する。
- RLSは`auth.uid()`と対象行の所有者を照合し、他ユーザー・未認証・許可外列の更新を拒否する。
- 取得失敗と保存失敗はAPIエラーをUI全体へ伝播させず、言語状態のfallbackと再試行境界へ変換する。

## 状態遷移と優先順位

1. 認証済みセッション確立後にアカウントlanguageを取得する。
2. 有効なアカウント値があれば端末値より優先して適用し、localStorageを同期する。
3. アカウント値が未設定なら既存localStorage値を検証して適用し、アカウントへ推測値を強制保存しない。
4. 端末値も無効または取得に失敗した場合は既定言語で利用を継続する。
5. 言語変更時はUIを先に反映し、保存失敗時は直前値または既定値へ戻せる状態を保持する。

## 要求別設計根拠

FR\-1 design: 永続化列、migration、生成型、プロフィール契約を同じ所有責務へ結び付ける。
FR\-2 design: セッション確立後の取得結果をlanguage state初期化へ渡し、別端末でも同じアカウント値を利用する。
FR\-3 design: selector変更を許可値へ正規化し、プロフィール更新mutationと端末キャッシュへ一貫して反映する。
FR\-4 design: アカウント値、端末値、既定値の優先順位を初期化関数の単一分岐として固定する。
FR\-5 design: 未設定と通信失敗を非致命的な状態として扱い、既定値または直前値でアプリを継続可能にする。
NFR\-1 design: 既存の日本語・英語localeと翻訳リソースを変更せず、同期経路だけを追加する。
NFR\-2 design: 認証ユーザー自身の行とlanguage列だけを更新可能にするAPI、RLS、サーバーallowlistを重ねる。
NFR\-3 design: プロフィール更新の許可列をnameと言語へ明示し、その他の列を入力schemaから排除する。
AC\-1 design: migration、型、API、RLSの各契約をアカウント所有責務の一つの設計根拠へ対応付ける。
AC\-2 design: ログイン初期化のloading境界を保ち、取得済みlanguageが初期表示へ反映される順序を固定する。
AC\-3 design: 変更イベント、mutation、成功後の再取得を同じ言語保存フローとして設計する。
AC\-4 design: 共有アカウントの取得を端末初期化より先に実行し、端末間で同じ値を選ぶ。
AC\-5 design: 未設定、取得失敗、保存失敗を個別のfallbackと再試行境界へ分解する。
AC\-6 design: 既存localeの表示責務を同期機能から分離し、日本語・英語の表示契約を保持する。
AC\-7 design: DB、型、API、RLS、更新条件、Web回帰を一つの検証計画に組み込む。

## 検証方針

FR\-1 verification: migration、生成型、プロフィール取得更新の整合と所有行制約をAPI・DBテストで確認する。
FR\-2 verification: 保存済み言語のログイン反映を複数端末fixtureで確認し、取得失敗でも画面が継続することを検証する。
FR\-3 verification: selector変更のpayload、成功後の再取得、保存失敗時の復元をunit・integration testで確認する。
FR\-4 verification: アカウント値ありなしと端末値ありなしの組合せで、採用値とlocalStorage同期結果を表にして検証する。
FR\-5 verification: 未設定・取得失敗・保存失敗を再現し、既定値または直前値で利用可能な状態を保つことを確認する。
NFR\-1 verification: 日本語と英語の主要画面、selector、既存翻訳キーの回帰テストを実行する。
NFR\-2 verification: 別ユーザー、未認証、許可外列の更新がAPIとRLSで拒否されることをnegative testで確認する。
NFR\-3 verification: nameと言語の更新だけが通り、他のプロフィール列がrejectされるallowlist回帰を確認する。
AC\-1 verification: 保存先と所有責務に対応するmigration・型・API・RLSの証拠をレビューと自動検証で確認する。
AC\-2 verification: ログインfixtureで保存済み言語が初期表示へ反映され、loading中に誤った既定値を確定しないことを確認する。
AC\-3 verification: 言語変更後の更新payloadと再取得値を確認し、アカウント保存の永続性を検証する。
AC\-4 verification: 端末Aで変更した値が端末Bの新規ログインで反映されるシナリオをintegration testで確認する。
AC\-5 verification: 3種類の異常系でアプリが利用不能にならず、定義したfallbackと再試行表示を確認する。
AC\-6 verification: 既存の日本語・英語主要画面と翻訳リソースのunit・integration回帰を実行する。
AC\-7 verification: DB migration検証、型check、API\/RLSテスト、Web lint・typecheck・unit integrationを記録する。

## 変更対象

- `apps/api`またはSupabase migration: users.language列、型、RLS、更新条件。
- `apps/web`のprofile mutation、ログイン初期化、language selector、localStorage同期とfallback。
- API/MSW fixture、unit/integration test、必要な生成型。
- RequirementsとDesignのcanonical JSON/Markdownはphase境界に従い、BuildでDesign完了後に固定する。

## リスクと確認事項

- アカウント値を強制的に推測保存すると既存利用者の意図しない変更になるため、未設定時の保存は明示操作に限定する。
- RLSだけでなくAPI allowlistも確認し、他列更新の混入を防ぐ。
- 保存失敗でUIだけ新言語にならないよう、直前値または既定値への復元を検証する。
- migration適用順と生成型の不一致があればBuildを完了せず停止する。

## Product Behavior Trace

```json
[{"id":"PB-1","type":"user_operation","change":"changed","requirement_id":"FR-3"},{"id":"PB-2","type":"state_transition","change":"changed","requirement_id":"FR-2"},{"id":"PB-3","type":"state_transition","change":"changed","requirement_id":"FR-4"},{"id":"PB-4","type":"state_transition","change":"changed","requirement_id":"FR-5"},{"id":"PB-5","type":"user_operation","change":"changed","requirement_id":"NFR-2"},{"id":"PB-6","type":"state_transition","change":"changed","requirement_id":"FR-1"},{"id":"PB-7","type":"state_transition","change":"changed","requirement_id":"NFR-3"}]
```

## Design Coverage Gate

```json
{"requirements_sha256":"c43d7a9a1ee41753fe5bf51ad7653f6bd8e95ebd6214c0dd669a8c1ced2b879f","workspace":"1563-issue-345418f11192","requirement_ids":["FR-1","FR-2","FR-3","FR-4","FR-5","NFR-1","NFR-2","NFR-3","AC-1","AC-2","AC-3","AC-4","AC-5","AC-6","AC-7"],"baseline":{"source":"none","body_sha256":null},"coverage":[{"id":"FR-1","design_block_id":"fr-1-design-evidence","verification_block_id":"fr-1-verification-evidence"},{"id":"FR-2","design_block_id":"fr-2-design-evidence","verification_block_id":"fr-2-verification-evidence"},{"id":"FR-3","design_block_id":"fr-3-design-evidence","verification_block_id":"fr-3-verification-evidence"},{"id":"FR-4","design_block_id":"fr-4-design-evidence","verification_block_id":"fr-4-verification-evidence"},{"id":"FR-5","design_block_id":"fr-5-design-evidence","verification_block_id":"fr-5-verification-evidence"},{"id":"NFR-1","design_block_id":"nfr-1-design-evidence","verification_block_id":"nfr-1-verification-evidence"},{"id":"NFR-2","design_block_id":"nfr-2-design-evidence","verification_block_id":"nfr-2-verification-evidence"},{"id":"NFR-3","design_block_id":"nfr-3-design-evidence","verification_block_id":"nfr-3-verification-evidence"},{"id":"AC-1","design_block_id":"ac-1-design-evidence","verification_block_id":"ac-1-verification-evidence"},{"id":"AC-2","design_block_id":"ac-2-design-evidence","verification_block_id":"ac-2-verification-evidence"},{"id":"AC-3","design_block_id":"ac-3-design-evidence","verification_block_id":"ac-3-verification-evidence"},{"id":"AC-4","design_block_id":"ac-4-design-evidence","verification_block_id":"ac-4-verification-evidence"},{"id":"AC-5","design_block_id":"ac-5-design-evidence","verification_block_id":"ac-5-verification-evidence"},{"id":"AC-6","design_block_id":"ac-6-design-evidence","verification_block_id":"ac-6-verification-evidence"},{"id":"AC-7","design_block_id":"ac-7-design-evidence","verification_block_id":"ac-7-verification-evidence"}],"baseline_sections":[]}
```

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
- Requirements SHA-256: `6ee3971b100c260d2fee149687292d83d22d3013265eec0c35a60a0ab37da0b1`
- Requirements Input Gate / Completeness Gate: artifact検証成功。
- Git `HEAD`の同workspace Design baseline SHA-256: `bee7992f0e2faf6060cc57c1425a34d534c53107620c360e4c1727041820f05a`。
- Requirementsと生成requirements.mdはread-onlyとし、BuildはこのDesignのreceiptを上流identityとして扱う。

context baseline: 入力と前提 baselineを、新しいRequirements hashとGit HEAD Design identityへ置換する。

## Rule Selection

- Requirements direct/selected: `domain.user`。public.users.languageをアカウント所有・認証境界のユーザードメインとして設計する。宣言済みdependency closureはない。
- Implementation surface: `web.query-cache`と`policy.transaction-boundaries`をquery/mutationへ、`web.feature-directory`と`web.component-structure`をprofile公開面へ、`web.test-policy`を回帰testへ適用する。
- Conflict decision: profile update allowlistはnameとlanguageだけを許可し、他の列へ広げない。

rule\-selection baseline: Rule Selection baselineへ、実装surfaceから適用するquery cache、transaction、feature公開面、test policyを加えて置換する。

## 採用する構成

### 永続化とAPI

`public.users.language`、生成型、プロフィール取得・更新API、RLSとサーバー側allowlistの既存契約を維持する。

### 初回Web状態

認証判定中と、認証済みユーザーのfresh profile取得中はchildrenを表示しない。取得成功時はaccount languageの非同期適用完了後、取得失敗または未設定時は端末値か既定値をfallbackとして決定後に初回表示を解放する。queryはmount時にsource of truthを再取得し、cached値をuser IDだけのguardで確定済みにしない。

### Feature境界

profile feature外のlanguage providerとpreferences featureは、profile rootの`index.ts`公開面からquery key、fetch、mutation hookを参照する。

architecture baseline: 採用する構成 baselineを、初回表示ready境界、fresh query追従、profile feature公開面を明示した内容へ置換する。

## データ・API境界

- migrationは`public.users.language`をnullableな既存互換値として追加し、対応値を日本語・英語へ限定する。
- profile updateの入力schemaとAPI型は`name`と`language`だけを更新可能列として明示する。
- RLSは`auth.uid()`と対象行の所有者を照合し、他ユーザー・未認証・許可外列の更新を拒否する。
- 取得失敗と保存失敗はAPIエラーをUI全体へ伝播させず、言語状態のfallbackと再試行境界へ変換する。

## 状態遷移と優先順位

1. session判定中は表示を待機し、未認証なら端末値または既定値で表示する。
2. 認証済みならmount時にprofileを必ず再取得し、初回fresh結果が決まるまで表示を待機する。
3. account languageがあれば非同期適用完了後に表示し、nullなら端末値、取得失敗なら端末値または既定値をfallbackとして確定後に表示する。推測値はaccountへ保存しない。
4. queryが後続のfresh値を返した場合はuser、language、data generationを識別して適用し、古い非同期処理の完了で上書きしない。
5. selector変更では先に端末言語を反映してwriteを行う。write失敗だけは直前値へ戻す。
6. write成功後のrefetch失敗は確認失敗としてerrorにし、端末言語を戻さず、次のrefetchでsource of truthへ収束可能にする。

state\-flow baseline: 状態遷移と優先順位 baselineを、初回ready、fresh generation、write失敗と確認失敗を分ける内容へ置換する。

## 要求別設計根拠

FR\-1 design: 永続化列、migration、生成型、プロフィール契約を同じ所有責務へ結び付ける。
FR\-2 design: fresh profile取得とaccount language適用の完了をuser単位のready stateへ記録し、それまでは初回children表示を保留する。
FR\-3 design: selector変更を許可値へ正規化し、write失敗だけを端末言語rollbackの条件にして、write後のrefetch失敗と分離する。
FR\-4 design: アカウント値、端末値、既定値の優先順位を初期化関数の単一分岐として固定する。
FR\-5 design: 未設定、取得失敗、write失敗、write成功後確認失敗を別状態にし、fallbackまたは収束可能な端末値で利用を継続する。
NFR\-1 design: 既存の日本語・英語localeと翻訳リソースを変更せず、同期経路だけを追加する。
NFR\-2 design: 認証ユーザー自身の行とlanguage列だけを更新可能にするAPI、RLS、サーバーallowlistを重ねる。
NFR\-3 design: プロフィール更新の許可列をnameと言語へ明示し、その他の列を入力schemaから排除する。
AC\-1 design: migration、型、API、RLSの各契約をアカウント所有責務の一つの設計根拠へ対応付ける。
AC\-2 design: ログイン初期化ではfresh profileとlanguage適用が完了するまで表示を待機し、保存済み値で初回表示を解放する。
AC\-3 design: 変更イベント、profile write、source of truth再取得を順序付け、writeと確認の結果を別に保持する。
AC\-4 design: mount時のfresh account取得を初回ready条件にし、cached端末値よりsource of truthを優先する。
AC\-5 design: 未設定、取得失敗、write失敗、確認失敗を個別のfallback、rollback、再取得境界へ分解する。
AC\-6 design: 既存localeの表示責務を同期機能から分離し、日本語・英語の表示契約を保持する。
AC\-7 design: DB、型、API、RLS、更新条件、Web回帰を一つの検証計画に組み込む。
AC\-8 design: 端末値とcached profileがaccount値と異なる場合も、fresh値の適用完了前にはchildrenを表示しない。
AC\-9 design: profile取得失敗をfallback決定としてready stateへ反映し、端末値または既定値でchildrenを表示する。
requirement\-design baseline: 要求別設計根拠 baselineへ、初回readyと確認失敗、および追加受け入れ条件のowned evidenceを加えて置換する。

## 検証方針

FR\-1 verification: migration、生成型、プロフィール取得更新の整合と所有行制約をAPI・DBテストで確認する。
FR\-2 verification: cached端末値とaccount値が異なるfixtureで、fresh値適用前にchildrenが表示されず、適用後に解放されることを確認する。
FR\-3 verification: selector変更のpayload、write失敗時の復元、write成功後refetch失敗時の非rollbackをunit・integration testで確認する。
FR\-4 verification: アカウント値ありなしと端末値ありなしの組合せで、採用値とlocalStorage同期結果を表にして検証する。
FR\-5 verification: 未設定、取得失敗、write失敗、write成功後確認失敗を再現し、各定義済み状態で利用を継続できることを確認する。
NFR\-1 verification: 日本語と英語の主要画面、selector、既存翻訳キーの回帰テストを実行する。
NFR\-2 verification: 別ユーザー、未認証、許可外列の更新がAPIとRLSで拒否されることをnegative testで確認する。
NFR\-3 verification: nameと言語の更新だけが通り、他のプロフィール列がrejectされるallowlist回帰を確認する。
AC\-1 verification: 保存先と所有責務に対応するmigration・型・API・RLSの証拠をレビューと自動検証で確認する。
AC\-2 verification: ログインfixtureで保存済み言語が適用された後に初回表示され、loading中は誤った端末値を表示しないことを確認する。
AC\-3 verification: 言語変更後の更新payload、再取得値、確認失敗時のmutation errorを区別して永続性を検証する。
AC\-4 verification: stale cache後にfresh account値が返る端末シナリオで、後続値へ収束することをintegration testで確認する。
AC\-5 verification: 取得、write、write後確認の各失敗でアプリが利用不能にならず、定義したfallback、rollback、非rollbackを確認する。
AC\-6 verification: 既存の日本語・英語主要画面と翻訳リソースのunit・integration回帰を実行する。
AC\-7 verification: DB migration検証、型check、API\/RLSテスト、Web lint・typecheck・unit integrationを記録する。
AC\-8 verification: 端末en、cached en、account jaの条件で、ja適用完了前はchildren不在、完了後は表示されることを確認する。
AC\-9 verification: profile GET失敗時は初期待機後にfallback言語でchildrenが表示され、利用可能になることを確認する。
verification baseline: 検証方針 baselineを、初回表示順序、fresh query追従、write後確認失敗の回帰testを加えた内容へ置換する。

## 変更対象

- `apps/web/src/providers/language/LanguageSyncProvider.tsx`とtest: 初回ready、fresh query、非同期適用generation。
- `apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.tsx`とtest: write失敗と確認失敗の分離。
- `apps/web/src/features/profile/profileSettings/useUpdateLanguage.ts`とprofile root `index.ts`: mutation result境界とfeature公開面。
- profile MSW fixtureは既存機能で不足する失敗順序だけを追加する。DB migration、生成型、RLSは既存契約がRequirementsを満たすため変更しない。
- RequirementsとDesignのcanonical JSON/MarkdownはDesign完了後にread-onlyとする。

implementation\-scope baseline: 変更対象 baselineを、language provider、selector、profile mutation、feature公開面、関連testへ限定して置換する。

## リスクと確認事項

- 初回待機中は空表示になるが、誤言語の確定表示を防ぐRequirements上の境界として採用する。
- cached値適用とfresh値適用の非同期完了順が逆転しないよう、effect cleanupとdata generationを検証する。
- write成功後確認失敗ではserver値が変わっている可能性があるため端末値を戻さず、mutation errorとquery再取得可能性を保持する。
- profile公開面は既存実装を再エクスポートする最小差分にし、新しい共有層を追加しない。
- DB、API、RLSの既存契約に不整合が見つかった場合はDesign scopeを越えて修正せず停止する。

risks baseline: リスクと確認事項 baselineを、cache鮮度、非同期完了順、write後確認失敗、公開面の観点へ更新して置換する。

## Product Behavior Trace

```json
[{"id":"PB-1","type":"user_operation","change":"changed","requirement_id":"FR-3"},{"id":"PB-2","type":"state_transition","change":"changed","requirement_id":"FR-2"},{"id":"PB-3","type":"state_transition","change":"changed","requirement_id":"FR-4"},{"id":"PB-4","type":"state_transition","change":"changed","requirement_id":"FR-5"},{"id":"PB-5","type":"user_operation","change":"changed","requirement_id":"NFR-2"},{"id":"PB-6","type":"state_transition","change":"changed","requirement_id":"FR-1"},{"id":"PB-7","type":"state_transition","change":"changed","requirement_id":"NFR-3"}]
```

## Design Coverage Gate

```json
{"requirements_sha256":"6ee3971b100c260d2fee149687292d83d22d3013265eec0c35a60a0ab37da0b1","workspace":"1563-issue-345418f11192","requirement_ids":["FR-1","FR-2","FR-3","FR-4","FR-5","NFR-1","NFR-2","NFR-3","AC-1","AC-2","AC-3","AC-4","AC-5","AC-6","AC-7","AC-8","AC-9"],"baseline":{"source":"git_head","body_sha256":"bee7992f0e2faf6060cc57c1425a34d534c53107620c360e4c1727041820f05a"},"coverage":[{"id":"FR-1","design_block_id":"fr-1-design-evidence","verification_block_id":"fr-1-verification-evidence"},{"id":"FR-2","design_block_id":"fr-2-design-evidence","verification_block_id":"fr-2-verification-evidence"},{"id":"FR-3","design_block_id":"fr-3-design-evidence","verification_block_id":"fr-3-verification-evidence"},{"id":"FR-4","design_block_id":"fr-4-design-evidence","verification_block_id":"fr-4-verification-evidence"},{"id":"FR-5","design_block_id":"fr-5-design-evidence","verification_block_id":"fr-5-verification-evidence"},{"id":"NFR-1","design_block_id":"nfr-1-design-evidence","verification_block_id":"nfr-1-verification-evidence"},{"id":"NFR-2","design_block_id":"nfr-2-design-evidence","verification_block_id":"nfr-2-verification-evidence"},{"id":"NFR-3","design_block_id":"nfr-3-design-evidence","verification_block_id":"nfr-3-verification-evidence"},{"id":"AC-1","design_block_id":"ac-1-design-evidence","verification_block_id":"ac-1-verification-evidence"},{"id":"AC-2","design_block_id":"ac-2-design-evidence","verification_block_id":"ac-2-verification-evidence"},{"id":"AC-3","design_block_id":"ac-3-design-evidence","verification_block_id":"ac-3-verification-evidence"},{"id":"AC-4","design_block_id":"ac-4-design-evidence","verification_block_id":"ac-4-verification-evidence"},{"id":"AC-5","design_block_id":"ac-5-design-evidence","verification_block_id":"ac-5-verification-evidence"},{"id":"AC-6","design_block_id":"ac-6-design-evidence","verification_block_id":"ac-6-verification-evidence"},{"id":"AC-7","design_block_id":"ac-7-design-evidence","verification_block_id":"ac-7-verification-evidence"},{"id":"AC-8","design_block_id":"ac-8-design-evidence","verification_block_id":"ac-8-verification-evidence"},{"id":"AC-9","design_block_id":"ac-9-design-evidence","verification_block_id":"ac-9-verification-evidence"}],"baseline_sections":[{"section_id":"context","heading":"入力と前提","content_sha256":"a765787e7f2e86c727015adc9015d323d25ba9669c621d5ebcb64285a7e9b5c4","status":"replaced","design_block_id":"baseline-context-evidence"},{"section_id":"rule-selection","heading":"Rule Selection","content_sha256":"2740a8b58903668adddebd2dd80916601fa716171691c454a3e360d30ef6ef82","status":"replaced","design_block_id":"baseline-rule-selection-evidence"},{"section_id":"architecture","heading":"採用する構成","content_sha256":"a00f867960071c7b6a11a664737382433410130268468f68957d756ebb06d62c","status":"replaced","design_block_id":"baseline-architecture-evidence"},{"section_id":"data-contract","heading":"データ・API境界","content_sha256":"6173e0b6666e8896e49f8ffed56d386954bdd674d378540a9ab3270463fcd49c","status":"preserved"},{"section_id":"state-flow","heading":"状態遷移と優先順位","content_sha256":"503b7daf3a9af916bf45460fe0d8faec9876bcba83f50c16db652d1f79fa5d0e","status":"replaced","design_block_id":"baseline-state-flow-evidence"},{"section_id":"requirement-design","heading":"要求別設計根拠","content_sha256":"190c76ca14518dafd44b1e736b433beb2ceb0296b6922a5b2928f37cb1f79e88","status":"replaced","design_block_id":"baseline-requirement-design-evidence"},{"section_id":"verification","heading":"検証方針","content_sha256":"7491b80492047a96cee613e6dd4c41ad00bec2c3ebb0a347755339a4f321b3fe","status":"replaced","design_block_id":"baseline-verification-evidence"},{"section_id":"implementation-scope","heading":"変更対象","content_sha256":"1f65d6192b9917789a66195772331f9b263cdaa92557f9f1c63954da6b921656","status":"replaced","design_block_id":"baseline-implementation-scope-evidence"},{"section_id":"risks","heading":"リスクと確認事項","content_sha256":"2c37ac39ac50caa7bf477908c4561e702668aebe5934bd0917d4d36258577ac1","status":"replaced","design_block_id":"baseline-risks-evidence"}]}
```

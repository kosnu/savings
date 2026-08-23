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
- Requirements SHA-256: `d07e46327f6b79687e9cf43a917e04458e1dbd39c882b46d1069469f0763b663`
- Requirements Input Gate / Completeness Gate: artifact検証成功。
- Git `HEAD`の同workspace Design baseline SHA-256: `ee8eb181a809e682c9846bc0555d4b95fa971287acb1987624ca5284df27b5ea`。
- Requirementsと生成requirements.mdはread-onlyとし、BuildはこのDesignのreceiptを上流identityとして扱う。

context baseline: 入力と前提 baselineを、現在のRequirements hashとGit HEAD Design identityへ置換する。

## Rule Selection

- Requirements direct/selected: `domain.user`。`public.users.language`のアカウント所有境界へ適用する。
- Implementation surfaces: `web-project`と`web-source`。`apps/web/**`と`apps/web/src/**`の予定変更からmachine review surfaceを選択する。
- Surface required rules: `policy.code-review`、`infrastructure.overview`、`web.test-policy`、`web.component-structure`、`web.design-system-brand`、`web.design-rules`、`web.feature-directory`、`web.query-cache`、`web.suspense-boundaries`。
- Path-specific additional rules: `ai-driven.workflow`、`policy.git-workflow`、`policy.review-feedback-classification`、`policy.temporal-data`、`domain.amount`、`domain.date`、`domain.payment`、`domain.category`、`domain.monthly-budget`、`domain.book`、`web.domain-layer-rules`、`web.domain-ui-rules`、`web.storybook-browser-tests`。予定するLanguageSelect、i18n resource、AppearanceSettings testのpath一致から選択する。
- Dependency closure: validatorがRequirements、surface、additional rulesの完全closureを固定する。
- Conflict decision: write失敗とwrite後の内部確認失敗を分ける。前者はrollbackとユーザー通知、後者はユーザー操作ではない再取得として通常利用を妨げず、profile update allowlistは広げない。

rule\-selection baseline: Rule Selection baselineを、machine review surfaceとそのrequired rule・dependency closureへ置換する。

## 採用する構成

### 永続化とAPI

`public.users.language`、生成型、プロフィール取得・更新API、RLSとサーバー側allowlistの既存契約を維持する。

### 認証世代

`SupabaseSessionProvider`が継続中セッションと新しい認証セッションの境界を所有し、認証済みstateへ`authenticationGeneration`を含める。初回認証、別ユーザーへの切替、サインアウト後の再ログインでは世代を進め、同じログイン中のtoken refreshでは維持する。

### 初回Web状態

`LanguageSyncProvider`はユーザーIDと認証世代をready identityにする。新しい世代では同じprofile query keyの旧取得をcancelし、その完了を待ってから明示refetchを開始する。profile queryFnはTanStack QueryのAbortSignalを`fetchProfile`経由でSupabase requestへ渡し、旧取得を実際に中断可能にする。cache値や旧取得の結果だけではreadyにせず、新世代で開始したrefetchの最新値を適用するか、そのrefetchの取得失敗・未設定としてfallbackを決定してからchildrenを解放する。token refreshでは世代が変わらないため既存表示を維持する。

### 保存失敗UI

`LanguageSelect`はprofile write契約の失敗だけを保存失敗として扱う。write失敗では直前言語へrollbackしたうえで、選択欄の直下に既存Callout形式の保存失敗alertを表示する。次の変更開始時に古いalertを消し、再試行可能なselectorは維持する。write成功後のrefetchは内部cache収束としてquery境界が所有し、その失敗を保存失敗、ユーザー向け未確認状態、selector無効化へ読み替えない。

### Feature境界

profile feature外のlanguage providerは、profile rootの`index.ts`公開面からquery keyとfetchを参照する。

architecture baseline: 採用する構成 baselineを、write失敗の通知と内部refetch失敗を分離するUI責務へ置換する。

## データ・API境界

- migrationは`public.users.language`をnullableな既存互換値として追加し、対応値を日本語・英語へ限定する。
- profile updateの入力schemaとAPI型は`name`と`language`だけを更新可能列として明示する。
- RLSは`auth.uid()`と対象行の所有者を照合し、他ユーザー・未認証・許可外列の更新を拒否する。
- 取得失敗と保存失敗はAPIエラーをUI全体へ伝播させず、言語状態のfallbackと再試行境界へ変換する。write失敗は型付きphaseを保ったままLanguageSelectへ渡し、rollbackだけで消費せずユーザー向けalertへ変換する。

data\-contract baseline: データ・API境界 baselineを、write失敗phaseからrollbackとユーザー向けalertへ変換する契約へ置換する。

## 状態遷移と優先順位

1. session判定中は表示を待機し、未認証なら端末値または既定値で表示する。同時に認証済みreadyと処理済みsnapshotを破棄する。
2. `SupabaseSessionProvider`は非認証または別ユーザーから認証済みへ移ると認証世代を進める。同じ認証済みユーザーのtoken refreshでは世代を維持する。
3. `LanguageSyncProvider`は認証世代が変わるたびに、同じユーザーの旧profile取得をcancelして完了を待ち、新世代の明示refetchを開始する。新世代のrefetchが解決するまでその世代を未確認としてchildrenを表示せず、既存cacheや旧取得の完了を新世代の完了扱いにしない。
4. account languageがあれば新世代refetchの値を非同期適用した後にuser IDと認証世代をreadyとして記録する。新世代refetchがnullまたは取得失敗なら端末値か既定値をfallbackとして確定後に同じreadyを記録し、推測値はaccountへ保存しない。
5. queryが後続のfresh値を返した場合はuser、language、data generationを識別して適用し、古い非同期処理の完了で上書きしない。
6. selector変更開始時に古いwrite失敗alertを消し、先に端末言語を反映してwriteを行う。write失敗では直前値へ戻して保存失敗alertを表示し、selectorから再試行できる状態を維持する。
7. profile write契約が成功した時点でユーザーの保存操作を成功として完了する。後続refetchはquery cacheの内部収束として扱い、失敗しても端末言語を戻さず、保存失敗alert、未確認表示、selector無効化を行わない。
8. 内部refetch失敗後の収束はquery境界のinvalidation、内部retry、または次回取得で行い、成功済みwriteを繰り返さない。

state\-flow baseline: 状態遷移と優先順位 baselineを、write成否と内部refetchを分離した遷移へ置換する。

## 要求別設計根拠

FR\-1 design: 永続化列、migration、生成型、プロフィール契約を同じ所有責務へ結び付ける。
FR\-2 design: 認証ライフサイクル所有者が新しい認証世代を発行し、旧profile取得のcancel完了後に開始した新世代refetchとaccount language適用の完了をuser ID・世代単位のreadyへ記録する。
FR\-3 design: selector変更を許可値へ正規化し、write失敗だけを端末言語rollbackの条件にして、write後のrefetch失敗と分離する。
FR\-4 design: アカウント値、端末値、既定値の優先順位を初期化関数の単一分岐として固定する。
FR\-5 design: 未設定、認証世代に帰属する初期取得失敗、profile write失敗を別状態にする。write失敗はrollbackとユーザー向けalertへ変換し、write成功後の内部refetch失敗はユーザー状態へ伝播せずquery境界で収束させる。
NFR\-1 design: 既存の日本語・英語localeと翻訳リソースを変更せず、同期経路だけを追加する。
NFR\-2 design: 認証ユーザー自身の行とlanguage列だけを更新可能にするAPI、RLS、サーバーallowlistを重ねる。
NFR\-3 design: プロフィール更新の許可列をnameと言語へ明示し、その他の列を入力schemaから排除する。
AC\-1 design: migration、型、API、RLSの各契約をアカウント所有責務の一つの設計根拠へ対応付ける。
AC\-2 design: ログイン初期化では旧世代の進行中取得を中断し、新しい認証世代で開始したfresh profileとlanguage適用が完了するまで表示を待機し、同一世代のtoken refreshでは表示を継続する。
AC\-3 design: 変更イベントとprofile writeをユーザー操作の完了境界にし、後続refetchはquery cacheの内部収束として分離して成功済みwriteを繰り返さない。
AC\-4 design: 同じユーザーの再ログインでも新しい認証世代自身のfresh account取得をready条件にし、fresh cacheや旧世代の進行中取得よりsource of truthを優先する。
AC\-5 design: 未設定、新しい認証世代に帰属する初期取得失敗、write失敗をfallback、rollback、保存失敗alertへ分解し、内部refetch失敗をユーザー向け保存結果へ混入させない。
AC\-6 design: 既存localeの表示責務を同期機能から分離し、日本語・英語の表示契約を保持する。
AC\-7 design: DB、型、API、RLS、更新条件、Web回帰を一つの検証計画に組み込む。
AC\-8 design: 初回またはsign\-out後の再ログインでは認証世代を更新し、旧取得の中断後に開始した新世代のfresh値適用前にchildrenを表示せず、同一世代のtoken refreshでは既に正しいchildrenを隠さない。
AC\-9 design: profile取得失敗をfallback決定としてready stateへ反映し、端末値または既定値でchildrenを表示する。
requirement\-design baseline: 要求別設計根拠 baselineを、write失敗通知と内部refetch責務を分離する要求所有へ置換する。

## 検証方針

FR\-1 verification: migration、生成型、プロフィール取得更新の整合と所有行制約をAPI・DBテストで確認する。
FR\-2 verification: 旧世代のprofile GETを未完了にした同一ユーザー再ログインで、事前invalidateなしに旧GETが中断されて新世代GETが発生し、新世代のfresh値適用前はchildrenが表示されず、同一認証世代のtoken refreshでは表示が継続することを確認する。
FR\-3 verification: selector変更のpayload、write失敗時の復元と保存失敗alert、write成功後refetch失敗時の非rollback・非通知・selector継続利用をunit・integration testで確認する。
FR\-4 verification: アカウント値ありなしと端末値ありなしの組合せで、採用値とlocalStorage同期結果を表にして検証する。
FR\-5 verification: write失敗時はrollback後も保存失敗alertが表示され、selectorで再試行できることを確認する。write成功後の内部refetch失敗では非rollback、通知なし、selector継続利用となり、query境界が後続取得で収束できることを確認する。
NFR\-1 verification: 日本語と英語の主要画面、selector、既存翻訳キーの回帰テストを実行する。
NFR\-2 verification: 別ユーザー、未認証、許可外列の更新がAPIとRLSで拒否されることをnegative testで確認する。
NFR\-3 verification: nameと言語の更新だけが通り、他のプロフィール列がrejectされるallowlist回帰を確認する。
AC\-1 verification: 保存先と所有責務に対応するmigration・型・API・RLSの証拠をレビューと自動検証で確認する。
AC\-2 verification: ログインfixtureで認証世代が初回認証とsign\-out後の再ログインで進み、token refreshでは維持されることに加え、世代切替時の取得完了が新世代に帰属することを確認する。
AC\-3 verification: write成功後の内部refetch失敗でPATCHが増えず、保存失敗表示や未確認状態を作らずに後続GETで再取得値へ収束することを検証する。
AC\-4 verification: 旧世代GETを未完了にしたままserver応答を変更して再ログインし、事前invalidateなしに旧GETの中断後、新世代GETで最新account値へ収束することをintegration testで確認する。
AC\-5 verification: 新しい認証世代に帰属する初期取得失敗とwrite失敗でアプリが利用不能にならず、write失敗のrollback後に保存失敗alertが残ること、内部refetch失敗はユーザーへ表示せず後続取得で収束することを確認する。
AC\-6 verification: 既存の日本語・英語主要画面と翻訳リソースのunit・integration回帰を実行する。
AC\-7 verification: DB migration検証、型check、API\/RLSテスト、Web lint・typecheck・unit integrationを記録する。
AC\-8 verification: 端末en、account ja、旧世代GET未完了の条件で、token refreshは表示を維持し、sign\-out後の同一ユーザー再ログインは旧GETを中断して新世代GETが完了するまで待機することを確認する。
AC\-9 verification: profile GET失敗時は初期待機後にfallback言語でchildrenが表示され、利用可能になることを確認する。
verification baseline: 検証方針 baselineを、write失敗通知と内部refetch失敗の非通知を分けて確認する回帰testへ置換する。

## 変更対象

- `apps/web/src/features/profile/profileSettings/useUpdateLanguage.ts`: profile write成功をユーザー操作の完了とし、後続refetch失敗をユーザー向けerror stateへ変換しない。内部cache収束はquery境界へ残す。
- `apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.tsx`: write失敗時はrollback後に既存Callout形式の保存失敗alertを表示する。内部refetch用の未確認表示、retry操作、selector無効化を削除する。
- `apps/web/src/i18n/resources.ts`: 保存失敗alertは維持し、内部refetch用の未確認・再確認文言を削除する。
- `apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx`: write失敗のrollback・alert・再試行可能状態と、write成功後refetch失敗時の非rollback・非通知・継続操作を回帰検証する。
- DB、RLS、profile write、認証世代、初回同期の既存契約は変更しない。
- Requirementsと生成requirements.mdはread-onlyとし、Design JSON/Markdownは同期生成する。

implementation\-scope baseline: 変更対象 baselineを、useUpdateLanguageの内部refetch責務、LanguageSelect、翻訳resource、AppearanceSettings回帰testへ置換する。

## リスクと確認事項

- write失敗例外をrollbackだけで消費すると、ユーザーは保存失敗と別端末同期を区別できないため、同じ分岐でalert stateも設定する。
- rollback後は表示言語が変わるため、alert文言はrollback後のlocaleで再描画できる翻訳keyとして保持する。
- write成功後の内部refetch失敗を保存失敗や未確認状態として表示すると、ユーザーが行っていない再取得の失敗を操作結果と誤認するため、query境界だけで収束させる。
- 古いwrite失敗alertが次の試行結果と誤認されないよう、次のselector変更開始時に消す。
- DB、RLS、profile write、認証世代、初回同期の既存契約に不整合が見つかった場合はDesign scopeを越えて修正せず停止する。

risks baseline: リスクと確認事項 baselineを、write失敗の無通知と内部refetch失敗の過剰なユーザー通知を同時に防ぐ観点へ置換する。

## Product Behavior Trace

```json
[{"id":"PB-1","type":"user_operation","change":"changed","requirement_id":"FR-3"},{"id":"PB-2","type":"state_transition","change":"changed","requirement_id":"FR-2"},{"id":"PB-3","type":"state_transition","change":"changed","requirement_id":"FR-4"},{"id":"PB-4","type":"state_transition","change":"changed","requirement_id":"FR-5"},{"id":"PB-5","type":"user_operation","change":"changed","requirement_id":"NFR-2"},{"id":"PB-6","type":"state_transition","change":"changed","requirement_id":"FR-1"},{"id":"PB-7","type":"state_transition","change":"changed","requirement_id":"NFR-3"}]
```

## Rule Coverage

```json
{"implementation_surfaces":["web-project","web-source"],"additional_rules":[{"id":"ai-driven.workflow","reason":"予定変更pathがapps/**に一致し、Build/Verify境界を適用する。"},{"id":"policy.git-workflow","reason":"予定変更pathがapps/**に一致し、Shipまでの差分境界を適用する。"},{"id":"policy.review-feedback-classification","reason":"予定変更pathがapps/**に一致し、既存review由来の設計判断をRequirementsへ混入させない。"},{"id":"policy.temporal-data","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"},{"id":"domain.amount","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"},{"id":"domain.date","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"},{"id":"domain.payment","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"},{"id":"domain.category","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"},{"id":"domain.monthly-budget","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"},{"id":"domain.book","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"},{"id":"web.domain-layer-rules","reason":"preferences feature pathに一致するfrontend domain境界を適用する。"},{"id":"web.domain-ui-rules","reason":"preferences feature pathに一致するdomain UI境界を適用する。"},{"id":"web.storybook-browser-tests","reason":"予定変更pathがapps/web/**に一致するためpath固有ruleとして選択する。"}]}
```

## Design Coverage Gate

```json
{"requirements_sha256":"d07e46327f6b79687e9cf43a917e04458e1dbd39c882b46d1069469f0763b663","workspace":"1563-issue-345418f11192","requirement_ids":["FR-1","FR-2","FR-3","FR-4","FR-5","NFR-1","NFR-2","NFR-3","AC-1","AC-2","AC-3","AC-4","AC-5","AC-6","AC-7","AC-8","AC-9"],"baseline":{"source":"git_head","body_sha256":"ee8eb181a809e682c9846bc0555d4b95fa971287acb1987624ca5284df27b5ea"},"coverage":[{"id":"FR-1","design_block_id":"fr-1-design-evidence","verification_block_id":"fr-1-verification-evidence"},{"id":"FR-2","design_block_id":"fr-2-design-evidence","verification_block_id":"fr-2-verification-evidence"},{"id":"FR-3","design_block_id":"fr-3-design-evidence","verification_block_id":"fr-3-verification-evidence"},{"id":"FR-4","design_block_id":"fr-4-design-evidence","verification_block_id":"fr-4-verification-evidence"},{"id":"FR-5","design_block_id":"fr-5-design-evidence","verification_block_id":"fr-5-verification-evidence"},{"id":"NFR-1","design_block_id":"nfr-1-design-evidence","verification_block_id":"nfr-1-verification-evidence"},{"id":"NFR-2","design_block_id":"nfr-2-design-evidence","verification_block_id":"nfr-2-verification-evidence"},{"id":"NFR-3","design_block_id":"nfr-3-design-evidence","verification_block_id":"nfr-3-verification-evidence"},{"id":"AC-1","design_block_id":"ac-1-design-evidence","verification_block_id":"ac-1-verification-evidence"},{"id":"AC-2","design_block_id":"ac-2-design-evidence","verification_block_id":"ac-2-verification-evidence"},{"id":"AC-3","design_block_id":"ac-3-design-evidence","verification_block_id":"ac-3-verification-evidence"},{"id":"AC-4","design_block_id":"ac-4-design-evidence","verification_block_id":"ac-4-verification-evidence"},{"id":"AC-5","design_block_id":"ac-5-design-evidence","verification_block_id":"ac-5-verification-evidence"},{"id":"AC-6","design_block_id":"ac-6-design-evidence","verification_block_id":"ac-6-verification-evidence"},{"id":"AC-7","design_block_id":"ac-7-design-evidence","verification_block_id":"ac-7-verification-evidence"},{"id":"AC-8","design_block_id":"ac-8-design-evidence","verification_block_id":"ac-8-verification-evidence"},{"id":"AC-9","design_block_id":"ac-9-design-evidence","verification_block_id":"ac-9-verification-evidence"}],"baseline_sections":[{"section_id":"context","heading":"入力と前提","content_sha256":"806dbd9c19546686ed959ab1c5aabfd0e9dee152154bcfb31c49d3123e430916","status":"replaced","design_block_id":"baseline-context-evidence"},{"section_id":"rule-selection","heading":"Rule Selection","content_sha256":"155d75b2156df72f1b5be7245241e8fba5c579312c91e1436150af132d51097c","status":"replaced","design_block_id":"baseline-rule-selection-evidence"},{"section_id":"architecture","heading":"採用する構成","content_sha256":"0007e5e3f9388f35e3e11e912ca1f67bf013db1cdee1149f95148bd2f010fe76","status":"replaced","design_block_id":"baseline-architecture-evidence"},{"section_id":"data-contract","heading":"データ・API境界","content_sha256":"9f359f4de03240cbd7814609e72d4f70fb7281da3fdb9e504a7b5d918bed23bc","status":"preserved"},{"section_id":"state-flow","heading":"状態遷移と優先順位","content_sha256":"b8f36dbfd673f8bf94a736b1bde900cbb95431c9d195efedd642de72f6edb461","status":"replaced","design_block_id":"baseline-state-flow-evidence"},{"section_id":"requirement-design","heading":"要求別設計根拠","content_sha256":"42340b507bed77a0b792cf5055ea800d1cbd7cad1a0b5c52caa6a785efe1cf52","status":"replaced","design_block_id":"baseline-requirement-design-evidence"},{"section_id":"verification","heading":"検証方針","content_sha256":"521d698a7cc58e86671654d46c7df97e062b63638577a91c8f55878459502190","status":"replaced","design_block_id":"baseline-verification-evidence"},{"section_id":"implementation-scope","heading":"変更対象","content_sha256":"2a05b62a13882ba181d7face13db7b5d195b5c64365b2d51749dbf441521dc69","status":"replaced","design_block_id":"baseline-implementation-scope-evidence"},{"section_id":"risks","heading":"リスクと確認事項","content_sha256":"09c735761bec9b68aaa0567163f09ead95f547ea663d05ca9543c0f06c8c13aa","status":"replaced","design_block_id":"baseline-risks-evidence"}]}
```

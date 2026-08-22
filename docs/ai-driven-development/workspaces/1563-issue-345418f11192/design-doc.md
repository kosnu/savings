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
- Requirements SHA-256: `3c7ad17535b170548ca5b473442584675eae9554a6c78f70dc35f7aaad4a4c66`
- Requirements Input Gate / Completeness Gate: artifact検証成功。
- Git `HEAD`の同workspace Design baseline SHA-256: `affd908aa8bca2d5964e981a269c3a55ce1dd13e8f0d020a32bf3e25540096e8`。
- Requirementsと生成requirements.mdはread-onlyとし、BuildはこのDesignのreceiptを上流identityとして扱う。

context baseline: 入力と前提 baselineを、今回のRequirements hashとGit HEAD Design identityへ置換する。

## Rule Selection

- Requirements direct/selected: `domain.user`。public.users.languageをアカウント所有・認証境界のユーザードメインとして設計する。宣言済みdependency closureはない。
- Implementation surface: `web.suspense-boundaries`を認証世代ごとの非同期readyへ適用し、そのdependencyである`web.query-cache`、`policy.transaction-boundaries`、`web.test-policy`を再取得・既存write境界・回帰testへ適用する。
- Session boundary: 継続中のtoken更新では認証世代を維持し、サインアウトを挟む新しい認証セッションでは同じユーザーでも世代を更新する。新しい世代はcache freshnessだけでなく旧世代の進行中取得にも依存せず、自身に帰属するprofile取得またはfallbackだけをready根拠にする。
- Conflict decision: profile update allowlistはnameとlanguageだけを許可し、他の列へ広げない。

rule\-selection baseline: Rule Selection baselineを、新しい認証セッションに帰属するfresh取得責務、旧取得の非昇格、token更新の継続条件へ置換する。

## 採用する構成

### 永続化とAPI

`public.users.language`、生成型、プロフィール取得・更新API、RLSとサーバー側allowlistの既存契約を維持する。

### 認証世代

`SupabaseSessionProvider`が継続中セッションと新しい認証セッションの境界を所有し、認証済みstateへ`authenticationGeneration`を含める。初回認証、別ユーザーへの切替、サインアウト後の再ログインでは世代を進め、同じログイン中のtoken refreshでは維持する。

### 初回Web状態

`LanguageSyncProvider`はユーザーIDと認証世代をready identityにする。新しい世代では同じprofile query keyの旧取得をcancelし、その完了を待ってから明示refetchを開始する。profile queryFnはTanStack QueryのAbortSignalを`fetchProfile`経由でSupabase requestへ渡し、旧取得を実際に中断可能にする。cache値や旧取得の結果だけではreadyにせず、新世代で開始したrefetchの最新値を適用するか、そのrefetchの取得失敗・未設定としてfallbackを決定してからchildrenを解放する。token refreshでは世代が変わらないため既存表示を維持する。

### Feature境界

profile feature外のlanguage providerは、profile rootの`index.ts`公開面からquery keyとfetchを参照する。

architecture baseline: 採用する構成 baselineを、認証世代の所有境界、旧取得のcancel、世代ごとの中断可能な明示refetchへ置換する。

## データ・API境界

- migrationは`public.users.language`をnullableな既存互換値として追加し、対応値を日本語・英語へ限定する。
- profile updateの入力schemaとAPI型は`name`と`language`だけを更新可能列として明示する。
- RLSは`auth.uid()`と対象行の所有者を照合し、他ユーザー・未認証・許可外列の更新を拒否する。
- 取得失敗と保存失敗はAPIエラーをUI全体へ伝播させず、言語状態のfallbackと再試行境界へ変換する。

## 状態遷移と優先順位

1. session判定中は表示を待機し、未認証なら端末値または既定値で表示する。同時に認証済みreadyと処理済みsnapshotを破棄する。
2. `SupabaseSessionProvider`は非認証または別ユーザーから認証済みへ移ると認証世代を進める。同じ認証済みユーザーのtoken refreshでは世代を維持する。
3. `LanguageSyncProvider`は認証世代が変わるたびに、同じユーザーの旧profile取得をcancelして完了を待ち、新世代の明示refetchを開始する。新世代のrefetchが解決するまでその世代を未確認としてchildrenを表示せず、既存cacheや旧取得の完了を新世代の完了扱いにしない。
4. account languageがあれば新世代refetchの値を非同期適用した後にuser IDと認証世代をreadyとして記録する。新世代refetchがnullまたは取得失敗なら端末値か既定値をfallbackとして確定後に同じreadyを記録し、推測値はaccountへ保存しない。
5. queryが後続のfresh値を返した場合はuser、language、data generationを識別して適用し、古い非同期処理の完了で上書きしない。
6. selector変更では先に端末言語を反映してwriteを行う。write失敗だけは直前値へ戻す。
7. write成功後のrefetch失敗は未確認状態としてLanguageSelectへ伝播する。端末言語は戻さず、未確認中はselectorを無効化し、確認できなかったことと再確認操作を表示する。
8. 再確認はprofile refetchだけを行い、成功済みwriteを繰り返さない。再確認が失敗した場合は未確認状態を維持し、成功した場合は通知を消してselectorを再び有効にし、source of truthへ収束する。

state\-flow baseline: 状態遷移と優先順位 baselineを、旧取得のcancel完了、新世代の明示refetch、その結果だけに基づくready解放条件へ置換する。

## 要求別設計根拠

FR\-1 design: 永続化列、migration、生成型、プロフィール契約を同じ所有責務へ結び付ける。
FR\-2 design: 認証ライフサイクル所有者が新しい認証世代を発行し、旧profile取得のcancel完了後に開始した新世代refetchとaccount language適用の完了をuser ID・世代単位のreadyへ記録する。
FR\-3 design: selector変更を許可値へ正規化し、write失敗だけを端末言語rollbackの条件にして、write後のrefetch失敗と分離する。
FR\-4 design: アカウント値、端末値、既定値の優先順位を初期化関数の単一分岐として固定する。
FR\-5 design: 未設定、認証世代に帰属する取得失敗、write失敗、write成功後確認失敗を別状態にする。旧世代の失敗を新世代のfallback根拠にせず、確認失敗はLanguageSelectへ伝播し、未確認中の追加writeを止め、確認用refetchだけで収束可能にする。
NFR\-1 design: 既存の日本語・英語localeと翻訳リソースを変更せず、同期経路だけを追加する。
NFR\-2 design: 認証ユーザー自身の行とlanguage列だけを更新可能にするAPI、RLS、サーバーallowlistを重ねる。
NFR\-3 design: プロフィール更新の許可列をnameと言語へ明示し、その他の列を入力schemaから排除する。
AC\-1 design: migration、型、API、RLSの各契約をアカウント所有責務の一つの設計根拠へ対応付ける。
AC\-2 design: ログイン初期化では旧世代の進行中取得を中断し、新しい認証世代で開始したfresh profileとlanguage適用が完了するまで表示を待機し、同一世代のtoken refreshでは表示を継続する。
AC\-3 design: 変更イベント、profile write、source of truth再取得を順序付け、writeと確認の結果を別に保持し、確認再試行ではwriteを繰り返さない。
AC\-4 design: 同じユーザーの再ログインでも新しい認証世代自身のfresh account取得をready条件にし、fresh cacheや旧世代の進行中取得よりsource of truthを優先する。
AC\-5 design: 未設定、新しい認証世代に帰属する取得失敗、write失敗、確認失敗を個別のfallback、rollback、通知、再確認境界へ分解する。
AC\-6 design: 既存localeの表示責務を同期機能から分離し、日本語・英語の表示契約を保持する。
AC\-7 design: DB、型、API、RLS、更新条件、Web回帰を一つの検証計画に組み込む。
AC\-8 design: 初回またはsign\-out後の再ログインでは認証世代を更新し、旧取得の中断後に開始した新世代のfresh値適用前にchildrenを表示せず、同一世代のtoken refreshでは既に正しいchildrenを隠さない。
AC\-9 design: profile取得失敗をfallback決定としてready stateへ反映し、端末値または既定値でchildrenを表示する。
requirement\-design baseline: 要求別設計根拠 baselineを、FR\-2が所有する認証世代、旧取得の非昇格、新世代fresh profile取得のready境界へ置換する。

## 検証方針

FR\-1 verification: migration、生成型、プロフィール取得更新の整合と所有行制約をAPI・DBテストで確認する。
FR\-2 verification: 旧世代のprofile GETを未完了にした同一ユーザー再ログインで、事前invalidateなしに旧GETが中断されて新世代GETが発生し、新世代のfresh値適用前はchildrenが表示されず、同一認証世代のtoken refreshでは表示が継続することを確認する。
FR\-3 verification: selector変更のpayload、write失敗時の復元、write成功後refetch失敗時の非rollbackをunit・integration testで確認する。
FR\-4 verification: アカウント値ありなしと端末値ありなしの組合せで、採用値とlocalStorage同期結果を表にして検証する。
FR\-5 verification: writeを1回だけ成功させた後の確認失敗を再現し、非rollback、通知、selector無効化、refetchだけの再確認、成功後の復帰を確認する。
NFR\-1 verification: 日本語と英語の主要画面、selector、既存翻訳キーの回帰テストを実行する。
NFR\-2 verification: 別ユーザー、未認証、許可外列の更新がAPIとRLSで拒否されることをnegative testで確認する。
NFR\-3 verification: nameと言語の更新だけが通り、他のプロフィール列がrejectされるallowlist回帰を確認する。
AC\-1 verification: 保存先と所有責務に対応するmigration・型・API・RLSの証拠をレビューと自動検証で確認する。
AC\-2 verification: ログインfixtureで認証世代が初回認証とsign\-out後の再ログインで進み、token refreshでは維持されることに加え、世代切替時の取得完了が新世代に帰属することを確認する。
AC\-3 verification: 確認再試行でPATCHが増えずGETだけが実行され、成功時に未確認状態が解消して再取得値へ収束することを検証する。
AC\-4 verification: 旧世代GETを未完了にしたままserver応答を変更して再ログインし、事前invalidateなしに旧GETの中断後、新世代GETで最新account値へ収束することをintegration testで確認する。
AC\-5 verification: 新しい認証世代に帰属する取得、write、write後確認の各失敗でアプリが利用不能にならず、旧世代の失敗をfallback根拠にしないこと、確認失敗の表示、再確認失敗時の継続、再確認成功時の収束を確認する。
AC\-6 verification: 既存の日本語・英語主要画面と翻訳リソースのunit・integration回帰を実行する。
AC\-7 verification: DB migration検証、型check、API\/RLSテスト、Web lint・typecheck・unit integrationを記録する。
AC\-8 verification: 端末en、account ja、旧世代GET未完了の条件で、token refreshは表示を維持し、sign\-out後の同一ユーザー再ログインは旧GETを中断して新世代GETが完了するまで待機することを確認する。
AC\-9 verification: profile GET失敗時は初期待機後にfallback言語でchildrenが表示され、利用可能になることを確認する。
verification baseline: 検証方針 baselineを、旧GET未完了かつ事前invalidateなしの同一ユーザー再ログインとtoken refreshを分離する回帰testへ置換する。

## 変更対象

- `apps/web/src/features/profile/profileSettings/fetchProfile.ts`: 任意のAbortSignalを受け取り、Supabase profile requestへ渡してquery cancellationを通信中断へ接続する。
- `apps/web/src/providers/language/LanguageSyncProvider.tsx`: user IDと認証世代をready identityにし、旧profile queryのcancel完了後に世代固有の明示refetchを開始し、その結果のlanguage適用またはfallbackでchildrenを解放する。
- `apps/web/src/features/profile/profileSettings/fetchProfile.integration.test.ts`: AbortSignalによる通信中断をAPI境界で検証する。
- `apps/web/src/providers/language/LanguageSyncProvider.test.tsx`: 旧GETを未完了のまま同一ユーザーを再ログインさせ、事前invalidateなしで旧GETの中断、新世代GET、待機、最新言語反映を検証する。
- `apps/web/src/providers/supabase/SupabaseSessionProvider.tsx`と関連fixture: 既存の認証世代契約を維持する。
- DB、RLS、言語変更write・確認の既存契約は変更しない。
- RequirementsとDesignのcanonical JSON/MarkdownはDesign完了後にread-onlyとする。

implementation\-scope baseline: 変更対象 baselineを、中断可能なprofile取得、旧取得をcancelするlanguage同期、取得中の世代切替回帰testへ限定して置換する。

## リスクと確認事項

- Sessionオブジェクトやuser IDだけではtoken refreshと同一ユーザー再ログインを区別できないため、認証ライフサイクル所有者が明示的な世代を提供する。
- 新しい認証世代でcache値または旧世代の進行中取得をready扱いすると古い言語や旧セッション由来の失敗で表示を解放するため、旧取得のcancel完了後に開始した明示refetchだけをready条件にする。
- queryFnがAbortSignalを通信へ渡さなければcancel完了と実通信の中断が分離するため、profile API境界までsignalを伝播する。
- token refreshごとに世代を進めると不要な待機とGETが発生するため、継続中の同一ユーザーセッションでは世代を維持する。
- 再ログインtestで初回GETの完了や事前invalidateを前提にすると欠陥を隠すため、旧GETを未完了にしたままserver応答変更、旧GET中断、新世代GET発生を確認する。
- DB、RLS、言語変更write・確認の既存契約に不整合が見つかった場合はDesign scopeを越えて修正せず停止する。

risks baseline: リスクと確認事項 baselineを、token refresh、同一ユーザー再ログイン、世代間の進行中取得を誤同一視しない観点へ置換する。

## Product Behavior Trace

```json
[{"id":"PB-1","type":"user_operation","change":"changed","requirement_id":"FR-3"},{"id":"PB-2","type":"state_transition","change":"changed","requirement_id":"FR-2"},{"id":"PB-3","type":"state_transition","change":"changed","requirement_id":"FR-4"},{"id":"PB-4","type":"state_transition","change":"changed","requirement_id":"FR-5"},{"id":"PB-5","type":"user_operation","change":"changed","requirement_id":"NFR-2"},{"id":"PB-6","type":"state_transition","change":"changed","requirement_id":"FR-1"},{"id":"PB-7","type":"state_transition","change":"changed","requirement_id":"NFR-3"}]
```

## Design Coverage Gate

```json
{"requirements_sha256":"3c7ad17535b170548ca5b473442584675eae9554a6c78f70dc35f7aaad4a4c66","workspace":"1563-issue-345418f11192","requirement_ids":["FR-1","FR-2","FR-3","FR-4","FR-5","NFR-1","NFR-2","NFR-3","AC-1","AC-2","AC-3","AC-4","AC-5","AC-6","AC-7","AC-8","AC-9"],"baseline":{"source":"git_head","body_sha256":"affd908aa8bca2d5964e981a269c3a55ce1dd13e8f0d020a32bf3e25540096e8"},"coverage":[{"id":"FR-1","design_block_id":"fr-1-design-evidence","verification_block_id":"fr-1-verification-evidence"},{"id":"FR-2","design_block_id":"fr-2-design-evidence","verification_block_id":"fr-2-verification-evidence"},{"id":"FR-3","design_block_id":"fr-3-design-evidence","verification_block_id":"fr-3-verification-evidence"},{"id":"FR-4","design_block_id":"fr-4-design-evidence","verification_block_id":"fr-4-verification-evidence"},{"id":"FR-5","design_block_id":"fr-5-design-evidence","verification_block_id":"fr-5-verification-evidence"},{"id":"NFR-1","design_block_id":"nfr-1-design-evidence","verification_block_id":"nfr-1-verification-evidence"},{"id":"NFR-2","design_block_id":"nfr-2-design-evidence","verification_block_id":"nfr-2-verification-evidence"},{"id":"NFR-3","design_block_id":"nfr-3-design-evidence","verification_block_id":"nfr-3-verification-evidence"},{"id":"AC-1","design_block_id":"ac-1-design-evidence","verification_block_id":"ac-1-verification-evidence"},{"id":"AC-2","design_block_id":"ac-2-design-evidence","verification_block_id":"ac-2-verification-evidence"},{"id":"AC-3","design_block_id":"ac-3-design-evidence","verification_block_id":"ac-3-verification-evidence"},{"id":"AC-4","design_block_id":"ac-4-design-evidence","verification_block_id":"ac-4-verification-evidence"},{"id":"AC-5","design_block_id":"ac-5-design-evidence","verification_block_id":"ac-5-verification-evidence"},{"id":"AC-6","design_block_id":"ac-6-design-evidence","verification_block_id":"ac-6-verification-evidence"},{"id":"AC-7","design_block_id":"ac-7-design-evidence","verification_block_id":"ac-7-verification-evidence"},{"id":"AC-8","design_block_id":"ac-8-design-evidence","verification_block_id":"ac-8-verification-evidence"},{"id":"AC-9","design_block_id":"ac-9-design-evidence","verification_block_id":"ac-9-verification-evidence"}],"baseline_sections":[{"section_id":"context","heading":"入力と前提","content_sha256":"c3dace06c55d381b04fa6f1fc68727da2aaf28cb0d1080bbcb60535022a264a9","status":"replaced","design_block_id":"baseline-context-evidence"},{"section_id":"rule-selection","heading":"Rule Selection","content_sha256":"cd9a28e6c1e8cf688c033c05780c44e87b917e7d0a2cb69dcaa920db393f89f9","status":"replaced","design_block_id":"baseline-rule-selection-evidence"},{"section_id":"architecture","heading":"採用する構成","content_sha256":"16c862c43e908c174e8b9da08c17782846a00889536cff0cc9b2a1f4f82722e9","status":"replaced","design_block_id":"baseline-architecture-evidence"},{"section_id":"data-contract","heading":"データ・API境界","content_sha256":"6173e0b6666e8896e49f8ffed56d386954bdd674d378540a9ab3270463fcd49c","status":"preserved"},{"section_id":"state-flow","heading":"状態遷移と優先順位","content_sha256":"faa2fa9270c950ad011876828b2acc402a76bf0c8e65ca1a5e1521973b859679","status":"replaced","design_block_id":"baseline-state-flow-evidence"},{"section_id":"requirement-design","heading":"要求別設計根拠","content_sha256":"a000338d15a95de4268080d074c7f966fa360a9bdbb631c0e1e7568f56e639d2","status":"replaced","design_block_id":"baseline-requirement-design-evidence"},{"section_id":"verification","heading":"検証方針","content_sha256":"f296b9045d4a058156e0df3352a4f9dfd2a7c65bc345365f0ba3b610c345e647","status":"replaced","design_block_id":"baseline-verification-evidence"},{"section_id":"implementation-scope","heading":"変更対象","content_sha256":"81fd2581c3fbe3a2a37d6b4cc88a5b376ca32b5fe04939abab1657f21ff91633","status":"replaced","design_block_id":"baseline-implementation-scope-evidence"},{"section_id":"risks","heading":"リスクと確認事項","content_sha256":"98fffaea21ba2859b6401487cefe3cdc1401e583eded53077d24bcddf34acfee","status":"replaced","design_block_id":"baseline-risks-evidence"}]}
```

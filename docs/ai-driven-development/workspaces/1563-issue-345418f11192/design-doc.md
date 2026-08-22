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
- Requirements SHA-256: `baab3d83687814c8a355e882c111bad98e47c852c59fd10c41336290cf16e834`
- Requirements Input Gate / Completeness Gate: artifact検証成功。
- Git `HEAD`の同workspace Design baseline SHA-256: `2a6986a08b990580f473f465e2c78efb75a9165d54f51633a15ed536b9ea48e7`。
- Requirementsと生成requirements.mdはread-onlyとし、BuildはこのDesignのreceiptを上流identityとして扱う。

context baseline: 入力と前提 baselineを、新しいRequirements hashとGit HEAD Design identityへ置換する。

## Rule Selection

- Requirements direct/selected: `domain.user`。public.users.languageをアカウント所有・認証境界のユーザードメインとして設計する。宣言済みdependency closureはない。
- Implementation surface: `web.suspense-boundaries`を非同期readyと認証ライフサイクルへ、`web.query-cache`と`policy.transaction-boundaries`をquery/mutationへ、`web.feature-directory`と`web.component-structure`をprofile公開面へ、`web.test-policy`を回帰testへ適用する。
- Confirmation boundary: write成功後の確認失敗は操作完了を所有するLanguageSelectへ伝播し、未確認中の追加writeを止め、再試行では確認用refetchだけを実行する。
- Conflict decision: profile update allowlistはnameとlanguageだけを許可し、他の列へ広げない。

rule\-selection baseline: Rule Selection baselineを、確認失敗の観測責務と成功済みwriteを繰り返さない再確認境界へ置換する。

## 採用する構成

### 永続化とAPI

`public.users.language`、生成型、プロフィール取得・更新API、RLSとサーバー側allowlistの既存契約を維持する。

### 初回Web状態

認証判定中と、認証済みユーザーのfresh profile取得中はchildrenを表示しない。取得成功時はaccount languageの非同期適用完了後、取得失敗または未設定時は端末値か既定値をfallbackとして決定後に初回表示を解放する。readyはSessionオブジェクト参照ではなくユーザーIDで照合し、同一ログイン中のtoken refreshでは維持する。一方、unauthenticatedへの遷移ではreadyと処理済みsnapshotを破棄し、同じユーザーの再ログインでもfresh結果まで再び待機する。

### Feature境界

profile feature外のlanguage providerとpreferences featureは、profile rootの`index.ts`公開面からquery key、fetch、mutation hookを参照する。

architecture baseline: 採用する構成 baselineを、Session参照に依存しないready同一性とsign\-out時の破棄条件へ置換する。

## データ・API境界

- migrationは`public.users.language`をnullableな既存互換値として追加し、対応値を日本語・英語へ限定する。
- profile updateの入力schemaとAPI型は`name`と`language`だけを更新可能列として明示する。
- RLSは`auth.uid()`と対象行の所有者を照合し、他ユーザー・未認証・許可外列の更新を拒否する。
- 取得失敗と保存失敗はAPIエラーをUI全体へ伝播させず、言語状態のfallbackと再試行境界へ変換する。

## 状態遷移と優先順位

1. session判定中は表示を待機し、未認証なら端末値または既定値で表示する。同時に認証済みreadyと処理済みsnapshotを破棄する。
2. 認証済みならmount時にprofileを必ず再取得し、初回fresh結果が決まるまで表示を待機する。
3. account languageがあれば非同期適用完了後にuser IDをreadyとして記録し、nullなら端末値、取得失敗なら端末値または既定値をfallbackとして確定後に同じreadyを記録する。推測値はaccountへ保存しない。
4. 同じuser IDのSessionオブジェクトだけがtoken refreshで置換されてもreadyは維持する。unauthenticatedを経た後は同じuser IDでもfresh結果まで待機する。
5. queryが後続のfresh値を返した場合はuser、language、data generationを識別して適用し、古い非同期処理の完了で上書きしない。
6. selector変更では先に端末言語を反映してwriteを行う。write失敗だけは直前値へ戻す。
7. write成功後のrefetch失敗は未確認状態としてLanguageSelectへ伝播する。端末言語は戻さず、未確認中はselectorを無効化し、確認できなかったことと再確認操作を表示する。
8. 再確認はprofile refetchだけを行い、成功済みwriteを繰り返さない。再確認が失敗した場合は未確認状態を維持し、成功した場合は通知を消してselectorを再び有効にし、source of truthへ収束する。

state\-flow baseline: 状態遷移と優先順位 baselineを、確認失敗の通知、操作抑止、refetch再確認、成功時復帰を含む内容へ置換する。

## 要求別設計根拠

FR\-1 design: 永続化列、migration、生成型、プロフィール契約を同じ所有責務へ結び付ける。
FR\-2 design: fresh profile取得とaccount language適用の完了をuser ID単位のreadyへ記録する。同一ログイン中のtoken refreshでは維持し、sign\-outで破棄する。
FR\-3 design: selector変更を許可値へ正規化し、write失敗だけを端末言語rollbackの条件にして、write後のrefetch失敗と分離する。
FR\-4 design: アカウント値、端末値、既定値の優先順位を初期化関数の単一分岐として固定する。
FR\-5 design: 未設定、取得失敗、write失敗、write成功後確認失敗を別状態にする。確認失敗はLanguageSelectへ伝播し、未確認中の追加writeを止め、確認用refetchだけで収束可能にする。
NFR\-1 design: 既存の日本語・英語localeと翻訳リソースを変更せず、同期経路だけを追加する。
NFR\-2 design: 認証ユーザー自身の行とlanguage列だけを更新可能にするAPI、RLS、サーバーallowlistを重ねる。
NFR\-3 design: プロフィール更新の許可列をnameと言語へ明示し、その他の列を入力schemaから排除する。
AC\-1 design: migration、型、API、RLSの各契約をアカウント所有責務の一つの設計根拠へ対応付ける。
AC\-2 design: ログイン初期化ではfresh profileとlanguage適用が完了するまで表示を待機し、完了後のtoken refreshでは表示を継続する。
AC\-3 design: 変更イベント、profile write、source of truth再取得を順序付け、writeと確認の結果を別に保持し、確認再試行ではwriteを繰り返さない。
AC\-4 design: mount時のfresh account取得を初回ready条件にし、cached端末値よりsource of truthを優先する。
AC\-5 design: 未設定、取得失敗、write失敗、確認失敗を個別のfallback、rollback、通知、再確認境界へ分解する。
AC\-6 design: 既存localeの表示責務を同期機能から分離し、日本語・英語の表示契約を保持する。
AC\-7 design: DB、型、API、RLS、更新条件、Web回帰を一つの検証計画に組み込む。
AC\-8 design: 初回またはsign\-out後の再ログインではfresh値適用前にchildrenを表示せず、同一ログイン中のtoken refreshでは既に正しいchildrenを隠さない。
AC\-9 design: profile取得失敗をfallback決定としてready stateへ反映し、端末値または既定値でchildrenを表示する。
requirement\-design baseline: 要求別設計根拠 baselineを、FR\-5、AC\-3、AC\-5が所有する確認失敗の観測と収束境界へ置換する。

## 検証方針

FR\-1 verification: migration、生成型、プロフィール取得更新の整合と所有行制約をAPI・DBテストで確認する。
FR\-2 verification: 初回fresh値適用前はchildrenが表示されず、適用後に同じuser IDのSessionオブジェクトが置換されても表示が継続することを確認する。
FR\-3 verification: selector変更のpayload、write失敗時の復元、write成功後refetch失敗時の非rollbackをunit・integration testで確認する。
FR\-4 verification: アカウント値ありなしと端末値ありなしの組合せで、採用値とlocalStorage同期結果を表にして検証する。
FR\-5 verification: writeを1回だけ成功させた後の確認失敗を再現し、非rollback、通知、selector無効化、refetchだけの再確認、成功後の復帰を確認する。
NFR\-1 verification: 日本語と英語の主要画面、selector、既存翻訳キーの回帰テストを実行する。
NFR\-2 verification: 別ユーザー、未認証、許可外列の更新がAPIとRLSで拒否されることをnegative testで確認する。
NFR\-3 verification: nameと言語の更新だけが通り、他のプロフィール列がrejectされるallowlist回帰を確認する。
AC\-1 verification: 保存先と所有責務に対応するmigration・型・API・RLSの証拠をレビューと自動検証で確認する。
AC\-2 verification: ログインfixtureで保存済み言語適用後に初回表示され、token refresh後も表示が継続し、sign\-out後の再ログインでは再び待機することを確認する。
AC\-3 verification: 確認再試行でPATCHが増えずGETだけが実行され、成功時に未確認状態が解消して再取得値へ収束することを検証する。
AC\-4 verification: stale cache後にfresh account値が返る端末シナリオで、後続値へ収束することをintegration testで確認する。
AC\-5 verification: 取得、write、write後確認の各失敗でアプリが利用不能にならず、確認失敗の表示、再確認失敗時の継続、再確認成功時の収束を確認する。
AC\-6 verification: 既存の日本語・英語主要画面と翻訳リソースのunit・integration回帰を実行する。
AC\-7 verification: DB migration検証、型check、API\/RLSテスト、Web lint・typecheck・unit integrationを記録する。
AC\-8 verification: 端末en、cached en、account jaの初回条件に加え、token refreshとsign\-out後の同一ユーザー再ログインでready境界を確認する。
AC\-9 verification: profile GET失敗時は初期待機後にfallback言語でchildrenが表示され、利用可能になることを確認する。
verification baseline: 検証方針 baselineを、write一回、GET再確認、通知、再失敗、成功収束を確認する回帰testへ置換する。

## 変更対象

- `apps/web/src/features/profile/profileSettings/useUpdateLanguage.ts`: writeと確認を分離したまま、確認用refetchだけを再実行するAPIとpending状態を公開する。
- `apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.tsx`: 確認失敗を通知し、未確認中はselectorを無効化し、再確認操作と成功後の復帰を所有する。
- `apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.stories.tsx`: 確認失敗の主要状態を追加する。
- `apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx`: write回数、確認用GET、通知、再失敗、成功収束をUIとAPI境界で検証する。
- `apps/web/src/i18n/resources.ts`: 確認失敗と再確認操作の日本語・英語文言を追加する。
- DB、API、RLS、LanguageSyncProviderの既存契約は変更しない。
- RequirementsとDesignのcanonical JSON/MarkdownはDesign完了後にread-onlyとする。

implementation\-scope baseline: 変更対象 baselineを、確認失敗を所有するhook、LanguageSelect、Story、回帰test、翻訳へ限定して置換する。

## リスクと確認事項

- 確認失敗後にselectorを有効なままにすると未確認中に別のwriteを開始できるため、再確認が成功するまでselectorを無効化する。
- 再確認でupdate mutationを繰り返すと成功済みwriteを重複させるため、profile refetchだけを独立した操作として公開する。
- 再確認の再失敗を握り潰すと完了と誤認するため、通知を維持して同じ再確認経路を残す。
- refetch成功時はsource of truthがLanguageSyncProvider経由で端末言語へ収束し、未確認状態だけを解除する。
- DB、API、RLS、LanguageSyncProviderの既存契約に不整合が見つかった場合はDesign scopeを越えて修正せず停止する。

risks baseline: リスクと確認事項 baselineを、成功済みwriteの重複と未確認中の追加writeを防ぐ観点へ置換する。

## Product Behavior Trace

```json
[{"id":"PB-1","type":"user_operation","change":"changed","requirement_id":"FR-3"},{"id":"PB-2","type":"state_transition","change":"changed","requirement_id":"FR-2"},{"id":"PB-3","type":"state_transition","change":"changed","requirement_id":"FR-4"},{"id":"PB-4","type":"state_transition","change":"changed","requirement_id":"FR-5"},{"id":"PB-5","type":"user_operation","change":"changed","requirement_id":"NFR-2"},{"id":"PB-6","type":"state_transition","change":"changed","requirement_id":"FR-1"},{"id":"PB-7","type":"state_transition","change":"changed","requirement_id":"NFR-3"}]
```

## Design Coverage Gate

```json
{"requirements_sha256":"baab3d83687814c8a355e882c111bad98e47c852c59fd10c41336290cf16e834","workspace":"1563-issue-345418f11192","requirement_ids":["FR-1","FR-2","FR-3","FR-4","FR-5","NFR-1","NFR-2","NFR-3","AC-1","AC-2","AC-3","AC-4","AC-5","AC-6","AC-7","AC-8","AC-9"],"baseline":{"source":"git_head","body_sha256":"2a6986a08b990580f473f465e2c78efb75a9165d54f51633a15ed536b9ea48e7"},"coverage":[{"id":"FR-1","design_block_id":"fr-1-design-evidence","verification_block_id":"fr-1-verification-evidence"},{"id":"FR-2","design_block_id":"fr-2-design-evidence","verification_block_id":"fr-2-verification-evidence"},{"id":"FR-3","design_block_id":"fr-3-design-evidence","verification_block_id":"fr-3-verification-evidence"},{"id":"FR-4","design_block_id":"fr-4-design-evidence","verification_block_id":"fr-4-verification-evidence"},{"id":"FR-5","design_block_id":"fr-5-design-evidence","verification_block_id":"fr-5-verification-evidence"},{"id":"NFR-1","design_block_id":"nfr-1-design-evidence","verification_block_id":"nfr-1-verification-evidence"},{"id":"NFR-2","design_block_id":"nfr-2-design-evidence","verification_block_id":"nfr-2-verification-evidence"},{"id":"NFR-3","design_block_id":"nfr-3-design-evidence","verification_block_id":"nfr-3-verification-evidence"},{"id":"AC-1","design_block_id":"ac-1-design-evidence","verification_block_id":"ac-1-verification-evidence"},{"id":"AC-2","design_block_id":"ac-2-design-evidence","verification_block_id":"ac-2-verification-evidence"},{"id":"AC-3","design_block_id":"ac-3-design-evidence","verification_block_id":"ac-3-verification-evidence"},{"id":"AC-4","design_block_id":"ac-4-design-evidence","verification_block_id":"ac-4-verification-evidence"},{"id":"AC-5","design_block_id":"ac-5-design-evidence","verification_block_id":"ac-5-verification-evidence"},{"id":"AC-6","design_block_id":"ac-6-design-evidence","verification_block_id":"ac-6-verification-evidence"},{"id":"AC-7","design_block_id":"ac-7-design-evidence","verification_block_id":"ac-7-verification-evidence"},{"id":"AC-8","design_block_id":"ac-8-design-evidence","verification_block_id":"ac-8-verification-evidence"},{"id":"AC-9","design_block_id":"ac-9-design-evidence","verification_block_id":"ac-9-verification-evidence"}],"baseline_sections":[{"section_id":"context","heading":"入力と前提","content_sha256":"95c72f2cbf8c333a5729101c0158603962e312e0b7b026ec9ec3d367141df67b","status":"replaced","design_block_id":"baseline-context-evidence"},{"section_id":"rule-selection","heading":"Rule Selection","content_sha256":"edb0d27b829d410b763b2c3ba585616a60167e27d637ec4615b78f0f361aad2f","status":"replaced","design_block_id":"baseline-rule-selection-evidence"},{"section_id":"architecture","heading":"採用する構成","content_sha256":"2616b39aa3b35bc2ac622a40af53b432ef144881ddeb308d1723b560e9ae7503","status":"preserved"},{"section_id":"data-contract","heading":"データ・API境界","content_sha256":"6173e0b6666e8896e49f8ffed56d386954bdd674d378540a9ab3270463fcd49c","status":"preserved"},{"section_id":"state-flow","heading":"状態遷移と優先順位","content_sha256":"4100e42d9e26277d706d0512dcc7bdb549963a6680b5d7a57f579474e962b67a","status":"replaced","design_block_id":"baseline-state-flow-evidence"},{"section_id":"requirement-design","heading":"要求別設計根拠","content_sha256":"5cca6c5806f9565c993fc6d2930cb060f21af2de1b849afed03490fa9878d47d","status":"replaced","design_block_id":"baseline-requirement-design-evidence"},{"section_id":"verification","heading":"検証方針","content_sha256":"8e2287a79641a9a82421e45ebc0af8ae050be1d1a2868f3ee13fab8f2dc9c5f7","status":"replaced","design_block_id":"baseline-verification-evidence"},{"section_id":"implementation-scope","heading":"変更対象","content_sha256":"e405ae0266414c2c89679626413ac231c949c350e9db482698fad5355ef95a34","status":"replaced","design_block_id":"baseline-implementation-scope-evidence"},{"section_id":"risks","heading":"リスクと確認事項","content_sha256":"aab25afbb440d49f9121c6ccdd5f7bb0edb8c784293aa620cae571fac271984a","status":"replaced","design_block_id":"baseline-risks-evidence"}]}
```

---
title: "Design Doc: Issue #1563"
doc_type: design-doc
status: proposed
area: repository
applies_to:
  - apps/web
  - apps/api
  - docs/harness/contracts/user-account-attributes.json
topics:
  - account-preference
  - language
  - synchronization
  - design
when_to_read:
  - Issue #1563の実装・検証方針を確認するとき
  - アカウント言語と端末fallbackの責務境界を確認するとき
---

# Design Doc: Issue #1563

- Requirements: `docs/ai-driven-development/workspaces/1563-issue-345418f11192/requirements.json`
- Requirements SHA-256: `d2241848fd39b6f9317a454640aaee01b82933ecb740a497ce9cff4f81eeadbf`
- Workspace: `1563-issue-345418f11192`

## Architecture

アカウント言語の永続化、取得、初回表示gate、保存、fallbackを、DB属性contract・Supabase境界・i18n境界・設定UIへ分離して接続する。

FR\-1 design: public\.users\.languageと属性contractをアカウント言語の正本として同期し、型境界から参照する。

FR\-1 verification: 取得queryと生成型がlanguage列を扱うことをintegration testとtypecheckで確認する。

FR\-2 design: session検証後にアカウント言語を解決し、解決完了まではauthenticated状態とユーザー向けRouterを確定しない。

FR\-2 verification: 遅延した言語取得中にsessionとRouterがloading表示を維持することをcomponent testで確認する。

FR\-3 design: LanguageSelectの操作を本人行language更新へ接続し、更新対象1件の成功後に選択言語を確定する。

FR\-3 verification: 設定UIの選択、更新payload、本人条件、更新件数をunit\/integration testで確認する。

FR\-4 design: アカウント値を最優先し、未設定または取得失敗時だけlocalStorage、次に既定値を採用し、自動保存しない。

FR\-4 verification: アカウント値優先と未設定fallbackの両経路、および推測値を保存しないことをintegration testで確認する。

FR\-5 design: 取得失敗はfallbackで利用継続し、保存失敗は直前言語へ戻して翻訳済みエラーを表示する。

FR\-5 verification: 取得失敗時の継続と保存失敗時のrollback・エラー表示を独立したtestで確認する。

NFR\-1 design: DB値と端末値はいずれも既存AppLanguageのen\/jaへ正規化し、対応言語集合を増やさない。

NFR\-1 verification: 日本語tagと英語・未知値の既存正規化結果をunit testで固定する。

NFR\-2 design: migration、attribute contract、DB型、更新queryをnameとlanguageのallowlistへ揃え、本人行RLSを維持する。

NFR\-2 verification: languageだけの更新payloadとauth\_user\_id条件をintegration testで検査し、他列更新を含めない。

AC\-1 design: 端末言語と異なるアカウント言語もsession初期化中に適用し、Router初回描画へ渡す。

AC\-1 verification: localStorageと異なる取得値が初回ユーザー画面より前に適用されることをprovider testで確認する。

AC\-2 design: 既存の日本語・英語resourceと設定画面を保ち、成功・失敗状態の文言だけを追加する。

AC\-2 verification: 設定画面の日本語・英語切替と保存失敗表示を既存component testへ統合して回帰確認する。

## Target State

```json
{"ownership_scopes":[{"kind":"file","path":"apps/api/supabase/migrations/20260830000000_add_user_language.sql"},{"kind":"file","path":"apps/web/src/app/Router.test.tsx"},{"kind":"file","path":"apps/web/src/app/Router.tsx"},{"kind":"file","path":"apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx"},{"kind":"file","path":"apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.tsx"},{"kind":"file","path":"apps/web/src/i18n/accountLanguage.integration.test.ts"},{"kind":"file","path":"apps/web/src/i18n/accountLanguage.ts"},{"kind":"file","path":"apps/web/src/i18n/index.test.ts"},{"kind":"file","path":"apps/web/src/i18n/index.ts"},{"kind":"file","path":"apps/web/src/i18n/resources.ts"},{"kind":"file","path":"apps/web/src/providers/supabase/SupabaseSessionProvider.test.tsx"},{"kind":"file","path":"apps/web/src/providers/supabase/SupabaseSessionProvider.tsx"},{"kind":"file","path":"apps/web/src/types/database.types.ts"},{"kind":"file","path":"docs/harness/contracts/user-account-attributes.json"}],"product_behaviors":[{"description":"認証ユーザーの言語正本がpublic.users.languageへ保存される","id":"PB-1","requirement_id":"FR-1","type":"state_transition"},{"description":"アカウント言語適用またはfallback決定まで認証画面の確定を待機する","id":"PB-2","requirement_id":"FR-2","type":"state_transition"},{"description":"設定画面の言語選択が本人アカウントへ保存され表示言語になる","id":"PB-3","requirement_id":"FR-3","type":"user_operation"},{"description":"アカウント値を端末値より優先し未設定時だけfallbackを採用する","id":"PB-4","requirement_id":"FR-4","type":"state_transition"},{"description":"取得失敗では利用継続し保存失敗では直前言語とエラー表示へ戻る","id":"PB-5","requirement_id":"FR-5","type":"state_transition"},{"description":"取得値と選択値が既存の英語または日本語へ正規化される","id":"PB-6","requirement_id":"NFR-1","type":"state_transition"},{"description":"認証クライアントは本人行のnameとlanguage以外を更新できない","id":"PB-7","requirement_id":"NFR-2","type":"state_transition"},{"description":"別端末の初回ユーザー画面が保存済みアカウント言語で描画される","id":"PB-8","requirement_id":"AC-1","type":"state_transition"},{"description":"既存の英語表示と日本語表示が同期機能追加後も維持される","id":"PB-9","requirement_id":"AC-2","type":"state_transition"}],"representations":[{"id":"REP-1","kind":"configuration","locator":{"kind":"file"},"path":"docs/harness/contracts/user-account-attributes.json","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","verification_case_ids":[]},{"id":"REP-2","kind":"migration","locator":{"kind":"file"},"path":"apps/api/supabase/migrations/20260830000000_add_user_language.sql","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","verification_case_ids":[]},{"id":"REP-3","kind":"test","locator":{"kind":"test_case","name":"アカウント言語の取得元をpublic.users.languageに限定する"},"path":"apps/web/src/i18n/accountLanguage.integration.test.ts","product_behavior_ids":[],"requirement_id":"FR-1","verification_case_ids":["VC-1"]},{"id":"REP-4","kind":"configuration","locator":{"kind":"file"},"path":"apps/web/src/types/database.types.ts","product_behavior_ids":[],"requirement_id":"FR-1","verification_case_ids":["VC-2"]},{"id":"REP-5","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/providers/supabase/SupabaseSessionProvider.tsx","product_behavior_ids":["PB-2"],"requirement_id":"FR-2","verification_case_ids":[]},{"id":"REP-6","kind":"test","locator":{"kind":"test_case","name":"アカウント言語の解決まで認証済み状態へ遷移しない"},"path":"apps/web/src/providers/supabase/SupabaseSessionProvider.test.tsx","product_behavior_ids":[],"requirement_id":"FR-2","verification_case_ids":["VC-3"]},{"id":"REP-7","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/app/Router.tsx","product_behavior_ids":["PB-2"],"requirement_id":"FR-2","verification_case_ids":[]},{"id":"REP-8","kind":"test","locator":{"kind":"test_case","name":"言語解決中は認証ローディング画面を表示する"},"path":"apps/web/src/app/Router.test.tsx","product_behavior_ids":[],"requirement_id":"FR-2","verification_case_ids":["VC-4"]},{"id":"REP-9","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.tsx","product_behavior_ids":["PB-3"],"requirement_id":"FR-3","verification_case_ids":[]},{"id":"REP-10","kind":"test","locator":{"kind":"test_case","name":"選択した言語をアカウントへ保存する"},"path":"apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx","product_behavior_ids":[],"requirement_id":"FR-3","verification_case_ids":["VC-5"]},{"id":"REP-11","kind":"test","locator":{"kind":"test_case","name":"アカウント言語の保存対象が1件であることを確認する"},"path":"apps/web/src/i18n/accountLanguage.integration.test.ts","product_behavior_ids":[],"requirement_id":"FR-3","verification_case_ids":["VC-6"]},{"id":"REP-12","kind":"implementation","locator":{"kind":"export","name":"resolveAccountLanguage"},"path":"apps/web/src/i18n/accountLanguage.ts","product_behavior_ids":["PB-4"],"requirement_id":"FR-4","verification_case_ids":[]},{"id":"REP-13","kind":"test","locator":{"kind":"test_case","name":"アカウント言語を端末言語より優先する"},"path":"apps/web/src/i18n/accountLanguage.integration.test.ts","product_behavior_ids":[],"requirement_id":"FR-4","verification_case_ids":["VC-7"]},{"id":"REP-14","kind":"test","locator":{"kind":"test_case","name":"未設定では端末言語へfallbackし自動保存しない"},"path":"apps/web/src/i18n/accountLanguage.integration.test.ts","product_behavior_ids":[],"requirement_id":"FR-4","verification_case_ids":["VC-8"]},{"id":"REP-15","kind":"implementation","locator":{"kind":"export","name":"loadAccountLanguage"},"path":"apps/web/src/i18n/accountLanguage.ts","product_behavior_ids":["PB-5"],"requirement_id":"FR-5","verification_case_ids":[]},{"id":"REP-16","kind":"test","locator":{"kind":"test_case","name":"取得失敗では端末言語へfallbackする"},"path":"apps/web/src/i18n/accountLanguage.integration.test.ts","product_behavior_ids":[],"requirement_id":"FR-5","verification_case_ids":["VC-9"]},{"id":"REP-17","kind":"test","locator":{"kind":"test_case","name":"保存失敗では表示言語を戻してエラーを表示する"},"path":"apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx","product_behavior_ids":[],"requirement_id":"FR-5","verification_case_ids":["VC-10"]},{"id":"REP-18","kind":"implementation","locator":{"kind":"export","name":"toAppLanguage"},"path":"apps/web/src/i18n/index.ts","product_behavior_ids":["PB-6"],"requirement_id":"NFR-1","verification_case_ids":[]},{"id":"REP-19","kind":"test","locator":{"kind":"test_case","name":"対応言語を日本語と英語に正規化する"},"path":"apps/web/src/i18n/index.test.ts","product_behavior_ids":[],"requirement_id":"NFR-1","verification_case_ids":["VC-11"]},{"id":"REP-20","kind":"configuration","locator":{"kind":"export","name":"Database"},"path":"apps/web/src/types/database.types.ts","product_behavior_ids":["PB-7"],"requirement_id":"NFR-2","verification_case_ids":[]},{"id":"REP-21","kind":"test","locator":{"kind":"test_case","name":"本人行のlanguageだけを更新する"},"path":"apps/web/src/i18n/accountLanguage.integration.test.ts","product_behavior_ids":[],"requirement_id":"NFR-2","verification_case_ids":["VC-12"]},{"id":"REP-22","kind":"test","locator":{"kind":"test_case","name":"端末言語と異なるアカウント言語を初回表示前に適用する"},"path":"apps/web/src/providers/supabase/SupabaseSessionProvider.test.tsx","product_behavior_ids":["PB-8"],"requirement_id":"AC-1","verification_case_ids":["VC-13"]},{"id":"REP-23","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/i18n/resources.ts","product_behavior_ids":["PB-9"],"requirement_id":"AC-2","verification_case_ids":[]},{"id":"REP-24","kind":"test","locator":{"kind":"test_case","name":"日本語と英語の表示を切り替えられる"},"path":"apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx","product_behavior_ids":[],"requirement_id":"AC-2","verification_case_ids":["VC-14"]}],"verification_cases":[{"id":"VC-1","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","selector":{"kind":"test_case","name":"アカウント言語の取得元をpublic.users.languageに限定する","path":"apps/web/src/i18n/accountLanguage.integration.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-2","product_behavior_ids":[],"requirement_id":"FR-1","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"web-typecheck"},{"id":"VC-3","product_behavior_ids":["PB-2"],"requirement_id":"FR-2","selector":{"kind":"test_case","name":"アカウント言語の解決まで認証済み状態へ遷移しない","path":"apps/web/src/providers/supabase/SupabaseSessionProvider.test.tsx"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-4","product_behavior_ids":[],"requirement_id":"FR-2","selector":{"kind":"test_case","name":"言語解決中は認証ローディング画面を表示する","path":"apps/web/src/app/Router.test.tsx"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-5","product_behavior_ids":["PB-3"],"requirement_id":"FR-3","selector":{"kind":"test_case","name":"選択した言語をアカウントへ保存する","path":"apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-6","product_behavior_ids":[],"requirement_id":"FR-3","selector":{"kind":"test_case","name":"アカウント言語の保存対象が1件であることを確認する","path":"apps/web/src/i18n/accountLanguage.integration.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-7","product_behavior_ids":["PB-4"],"requirement_id":"FR-4","selector":{"kind":"test_case","name":"アカウント言語を端末言語より優先する","path":"apps/web/src/i18n/accountLanguage.integration.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-8","product_behavior_ids":[],"requirement_id":"FR-4","selector":{"kind":"test_case","name":"未設定では端末言語へfallbackし自動保存しない","path":"apps/web/src/i18n/accountLanguage.integration.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-9","product_behavior_ids":["PB-5"],"requirement_id":"FR-5","selector":{"kind":"test_case","name":"取得失敗では端末言語へfallbackする","path":"apps/web/src/i18n/accountLanguage.integration.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-10","product_behavior_ids":[],"requirement_id":"FR-5","selector":{"kind":"test_case","name":"保存失敗では表示言語を戻してエラーを表示する","path":"apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-11","product_behavior_ids":["PB-6"],"requirement_id":"NFR-1","selector":{"kind":"test_case","name":"対応言語を日本語と英語に正規化する","path":"apps/web/src/i18n/index.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-12","product_behavior_ids":["PB-7"],"requirement_id":"NFR-2","selector":{"kind":"test_case","name":"本人行のlanguageだけを更新する","path":"apps/web/src/i18n/accountLanguage.integration.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-13","product_behavior_ids":["PB-8"],"requirement_id":"AC-1","selector":{"kind":"test_case","name":"端末言語と異なるアカウント言語を初回表示前に適用する","path":"apps/web/src/providers/supabase/SupabaseSessionProvider.test.tsx"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-14","product_behavior_ids":["PB-9"],"requirement_id":"AC-2","selector":{"kind":"test_case","name":"日本語と英語の表示を切り替えられる","path":"apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"}]}
```

## Rule Coverage

```json
{"additional_rules":[{"id":"adr.agent-rule-graph","reason":"mutable属性contractのpathを機械review surfaceへ分類するため"},{"id":"ai-driven.workflow","reason":"AIDD workspace外のapps実装pathへ工程境界を適用するため"},{"id":"policy.learning-extraction","reason":"apps変更から得た再利用可能な検証findingを既存分類へ接続するため"},{"id":"policy.git-workflow","reason":"appsとmigrationのtask-owned変更へrepository git境界を適用するため"},{"id":"policy.review-feedback-classification","reason":"apps変更のreview findingをscope別に分類するため"},{"id":"web.domain-layer-rules","reason":"preferences配下の言語同期責務をfeature境界へ配置するため"},{"id":"web.domain-ui-rules","reason":"LanguageSelectの表示とアカウント更新責務をUI境界へ接続するため"},{"id":"web.storybook-browser-tests","reason":"既存Storybook由来component testの境界を保つため"}],"implementation_surfaces":["web-project","web-source","api-project"]}
```

## Design Coverage Gate

```json
{"baseline":{"body_sha256":"2a6c4c024b48e06d34891ce2e2e670a2ea409a0977df12475bd00fd35150078d","source":"git_head"},"baseline_sections":[{"content_sha256":"fd3b4733830cecd1926480b321ac9e82b78faae954ac08ba6444b4071e00de81","heading":"Architecture","section_id":"architecture","status":"preserved"}],"coverage":[{"design_block_id":"fr-1-design","id":"FR-1","verification_block_id":"fr-1-verification"},{"design_block_id":"fr-2-design","id":"FR-2","verification_block_id":"fr-2-verification"},{"design_block_id":"fr-3-design","id":"FR-3","verification_block_id":"fr-3-verification"},{"design_block_id":"fr-4-design","id":"FR-4","verification_block_id":"fr-4-verification"},{"design_block_id":"fr-5-design","id":"FR-5","verification_block_id":"fr-5-verification"},{"design_block_id":"nfr-1-design","id":"NFR-1","verification_block_id":"nfr-1-verification"},{"design_block_id":"nfr-2-design","id":"NFR-2","verification_block_id":"nfr-2-verification"},{"design_block_id":"ac-1-design","id":"AC-1","verification_block_id":"ac-1-verification"},{"design_block_id":"ac-2-design","id":"AC-2","verification_block_id":"ac-2-verification"}],"requirement_ids":["FR-1","FR-2","FR-3","FR-4","FR-5","NFR-1","NFR-2","AC-1","AC-2"],"requirements_sha256":"d2241848fd39b6f9317a454640aaee01b82933ecb740a497ce9cff4f81eeadbf","workspace":"1563-issue-345418f11192"}
```

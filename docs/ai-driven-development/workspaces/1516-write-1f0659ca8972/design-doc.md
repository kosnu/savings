---
title: "Design Doc: Issue #1516"
doc_type: design-doc
status: proposed
area: repository
applies_to:
  - apps/web
  - apps/api
topics:
  - monthly-budget
  - rpc
  - temporal-data
  - design
when_to_read:
  - Issue #1516の実装・検証方針を確認するとき
  - 月予算record-ID write境界を確認するとき
---

# Design Doc: Issue #1516

- Requirements: `docs/ai-driven-development/workspaces/1516-write-1f0659ca8972/requirements.json`
- Requirements SHA-256: `b37c546132efc69783771d92cdc11ab9871fc47b733ca5c86974303736c5d182`
- Workspace: `1516-write-1f0659ca8972`

## Architecture

Webは表示済み月予算record IDと操作内容だけをRPCへ渡す。RPCは認証default Book、DB current_date由来の当月、現在有効なamount行とのID一致を同一transaction内で検証し、当月行は更新、過去有効行は当月行追加、不正対象は拒否する。

FR\-1 design: Webのupdate\/remove入力をmonthly budget IDと操作内容へ限定し、target\_monthとcurrent\_monthをRPC payloadへ含めない。

FR\-1 verification: mapperのexact testでrecord IDとamountだけがRPC引数になることを確認する。

FR\-2 design: RPCは認証default BookとDB current\_dateから現在有効なamount行をlockし、入力IDとの一致後だけwriteする。

FR\-2 verification: 別Bookまたは現在有効行と異なるIDが拒否されることをDB手順で確認する。

FR\-3 design: 入力IDが当月開始の現在有効amount行なら、その行のamountだけを更新する。

FR\-3 verification: 当月開始行のIDと新金額を渡し同じIDのamountだけが変わることをDB手順で確認する。

FR\-4 design: 入力IDが過去月開始で当月にも有効なら、過去行を保持して当月開始amount行をinsertする。

FR\-4 verification: 過去有効行IDで更新し過去行不変と当月amount行追加をDB手順で確認する。

FR\-5 design: 未来開始、非current\-effective、none状態、他BookのIDによる更新は例外で拒否する。

FR\-5 verification: 各許可外IDで更新RPCが失敗し行が変わらないことをDB手順で確認する。

FR\-6 design: 入力IDが当月開始の現在有効amount行なら、同じ行をstatus noneかつamount nullへ更新する。

FR\-6 verification: 当月開始行IDで無効化し同じIDがnone状態になることをDB手順で確認する。

FR\-7 design: 入力IDが過去月開始で当月にも有効なら、過去行を保持して当月開始none行をinsertする。

FR\-7 verification: 過去有効行IDで無効化し過去行不変と当月none行追加をDB手順で確認する。

FR\-8 design: 未来開始、非current\-effective、none状態、他BookのIDによる無効化は例外で拒否する。

FR\-8 verification: 各許可外IDで無効化RPCが失敗し行が変わらないことをDB手順で確認する。

NFR\-1 design: 過去有効行への操作では当月行だけを追加し、過去行のcontentと過去月のeffective取得結果を維持する。

NFR\-1 verification: 更新と無効化の前後で過去月取得結果が同じことをDB手順で確認する。

NFR\-2 design: 既存amountとnoneのDB制約、およびunsetを表す取得responseを変更せず、新しいtimezoneまたはBackend API層を導入しない。

NFR\-2 verification: 既存状態制約とeffective取得responseが維持されることをDB手順とWeb suiteで確認する。

AC\-1 design: LatestMonthlyBudgetが取得済みrecord IDをupdate\/remove modalへ渡し、両RPC呼出しが月引数なしで実行される。

AC\-1 verification: update\/remove clientのexact testでrecord IDを含み月引数を含まないpayloadを確認する。

AC\-2 design: RPCは現在有効amount行とのID一致を必須にして未来、stale、none、非所有IDのcurrent writeを拒否する。

AC\-2 verification: 全拒否caseで例外と不変な行状態をDB手順で確認する。

AC\-3 design: migrationとWeb境界をread\-onlyのmonthly\-budget、transaction、temporal ruleに一致させ、rule文書自体は変更しない。

AC\-3 verification: migrationの認可期間、record\-ID境界、履歴遷移がreceipt固定ruleと一致することを確認する。

AC\-4 design: 既存UI表示、query invalidation、エラー処理を維持し、RPC payloadとMSW contractだけをrecord\-ID入力へ同期する。

AC\-4 verification: Web unit\/integration suite、typecheck、lint、format\-check、diff\-checkを実行する。

## Target State

```json
{"ownership_scopes":[{"kind":"file","path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql"},{"kind":"file","path":"apps/web/src/features/budgets/latestMonthlyBudget/LatestMonthlyBudget/LatestMonthlyBudget.test.tsx"},{"kind":"file","path":"apps/web/src/features/budgets/latestMonthlyBudget/LatestMonthlyBudget/LatestMonthlyBudget.tsx"},{"kind":"file","path":"apps/web/src/features/budgets/removeMonthlyBudget/RemoveMonthlyBudgetModal/RemoveMonthlyBudgetModal.tsx"},{"kind":"file","path":"apps/web/src/features/budgets/removeMonthlyBudget/removeMonthlyBudget.test.ts"},{"kind":"file","path":"apps/web/src/features/budgets/removeMonthlyBudget/removeMonthlyBudget.ts"},{"kind":"file","path":"apps/web/src/features/budgets/removeMonthlyBudget/useRemoveMonthlyBudget.test.tsx"},{"kind":"file","path":"apps/web/src/features/budgets/removeMonthlyBudget/useRemoveMonthlyBudget.ts"},{"kind":"file","path":"apps/web/src/features/budgets/updateMonthlyBudget/UpdateMonthlyBudgetForm/UpdateMonthlyBudgetForm.test.tsx"},{"kind":"file","path":"apps/web/src/features/budgets/updateMonthlyBudget/UpdateMonthlyBudgetForm/UpdateMonthlyBudgetForm.tsx"},{"kind":"file","path":"apps/web/src/features/budgets/updateMonthlyBudget/monthlyBudgetUpdateMappers.test.ts"},{"kind":"file","path":"apps/web/src/features/budgets/updateMonthlyBudget/monthlyBudgetUpdateMappers.ts"},{"kind":"file","path":"apps/web/src/features/budgets/updateMonthlyBudget/updateMonthlyBudget.test.ts"},{"kind":"file","path":"apps/web/src/features/budgets/updateMonthlyBudget/updateMonthlyBudget.ts"},{"kind":"file","path":"apps/web/src/features/budgets/updateMonthlyBudget/useUpdateMonthlyBudget.test.tsx"},{"kind":"file","path":"apps/web/src/test/msw/handlers/monthlyBudgets.ts"},{"kind":"file","path":"apps/web/src/types/database.types.ts"}],"product_behaviors":[{"description":"月予算writeのクライアント入力がrecord IDと操作内容だけになる","id":"PB-1","requirement_id":"FR-1","type":"user_operation"},{"description":"RPCが認証Bookの現在有効amount行と入力record IDの一致後だけwriteする","id":"PB-2","requirement_id":"FR-2","type":"state_transition"},{"description":"当月開始の現在有効amount行は同じrecordの金額へ更新される","id":"PB-3","requirement_id":"FR-3","type":"state_transition"},{"description":"過去開始の現在有効amount行は保持され当月開始amount行が追加される","id":"PB-4","requirement_id":"FR-4","type":"state_transition"},{"description":"未来開始または現在有効amount行でないrecordへの更新が拒否される","id":"PB-5","requirement_id":"FR-5","type":"state_transition"},{"description":"当月開始の現在有効amount行は同じrecordのnone状態へ無効化される","id":"PB-6","requirement_id":"FR-6","type":"state_transition"},{"description":"過去開始の現在有効amount行は保持され当月開始none行が追加される","id":"PB-7","requirement_id":"FR-7","type":"state_transition"},{"description":"未来開始または現在有効amount行でないrecordへの無効化が拒否される","id":"PB-8","requirement_id":"FR-8","type":"state_transition"},{"description":"当月write後も過去月のeffective月予算結果が変化しない","id":"PB-9","requirement_id":"NFR-1","type":"state_transition"},{"description":"月予算のamount、none、unset状態モデルがwrite境界変更後も維持される","id":"PB-10","requirement_id":"NFR-2","type":"state_transition"},{"description":"更新と無効化がtarget_monthまたはcurrent_monthなしのrecord-ID RPCで完了する","id":"PB-11","requirement_id":"AC-1","type":"user_operation"},{"description":"未来、stale、none、非所有recordのcurrent writeがRPC境界で拒否される","id":"PB-12","requirement_id":"AC-2","type":"state_transition"},{"description":"月予算write実装がrecord-ID認可、信頼時刻、履歴保持ruleへ一致する","id":"PB-13","requirement_id":"AC-3","type":"state_transition"},{"description":"既存の月予算表示、成功後再取得、失敗表示が境界変更後も動作する","id":"PB-14","requirement_id":"AC-4","type":"user_operation"}],"representations":[{"id":"REP-1","kind":"implementation","locator":{"kind":"export","name":"toMonthlyBudgetUpdateArgs"},"path":"apps/web/src/features/budgets/updateMonthlyBudget/monthlyBudgetUpdateMappers.ts","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","verification_case_ids":[]},{"id":"REP-2","kind":"test","locator":{"kind":"test_case","name":"月予算IDと金額をRPC引数に変換する"},"path":"apps/web/src/features/budgets/updateMonthlyBudget/monthlyBudgetUpdateMappers.test.ts","product_behavior_ids":[],"requirement_id":"FR-1","verification_case_ids":["VC-1"]},{"id":"REP-3","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/updateMonthlyBudget/UpdateMonthlyBudgetForm/UpdateMonthlyBudgetForm.tsx","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","verification_case_ids":[]},{"id":"REP-4","kind":"test","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/updateMonthlyBudget/UpdateMonthlyBudgetForm/UpdateMonthlyBudgetForm.test.tsx","product_behavior_ids":[],"requirement_id":"FR-1","verification_case_ids":[]},{"id":"REP-5","kind":"migration","locator":{"kind":"export","name":"update_current_monthly_budget"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-2"],"requirement_id":"FR-2","verification_case_ids":["VC-2"]},{"id":"REP-6","kind":"migration","locator":{"kind":"export","name":"update_current_monthly_budget current-row transition"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-3"],"requirement_id":"FR-3","verification_case_ids":["VC-3"]},{"id":"REP-7","kind":"migration","locator":{"kind":"export","name":"update_current_monthly_budget history transition"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-4"],"requirement_id":"FR-4","verification_case_ids":["VC-4"]},{"id":"REP-8","kind":"migration","locator":{"kind":"export","name":"update_current_monthly_budget rejection"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-5"],"requirement_id":"FR-5","verification_case_ids":["VC-5"]},{"id":"REP-9","kind":"migration","locator":{"kind":"export","name":"remove_current_monthly_budget current-row transition"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-6"],"requirement_id":"FR-6","verification_case_ids":["VC-6"]},{"id":"REP-10","kind":"migration","locator":{"kind":"export","name":"remove_current_monthly_budget history transition"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-7"],"requirement_id":"FR-7","verification_case_ids":["VC-7"]},{"id":"REP-11","kind":"migration","locator":{"kind":"export","name":"remove_current_monthly_budget rejection"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-8"],"requirement_id":"FR-8","verification_case_ids":["VC-8"]},{"id":"REP-12","kind":"migration","locator":{"kind":"export","name":"history preservation contract"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-9"],"requirement_id":"NFR-1","verification_case_ids":["VC-9"]},{"id":"REP-13","kind":"migration","locator":{"kind":"export","name":"state model compatibility contract"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-10"],"requirement_id":"NFR-2","verification_case_ids":["VC-10"]},{"id":"REP-14","kind":"implementation","locator":{"kind":"export","name":"updateMonthlyBudget"},"path":"apps/web/src/features/budgets/updateMonthlyBudget/updateMonthlyBudget.ts","product_behavior_ids":["PB-11"],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-15","kind":"test","locator":{"kind":"test_case","name":"対象月予算IDとamountを更新RPCに渡す"},"path":"apps/web/src/features/budgets/updateMonthlyBudget/updateMonthlyBudget.test.ts","product_behavior_ids":[],"requirement_id":"AC-1","verification_case_ids":["VC-11"]},{"id":"REP-16","kind":"implementation","locator":{"kind":"export","name":"removeMonthlyBudget"},"path":"apps/web/src/features/budgets/removeMonthlyBudget/removeMonthlyBudget.ts","product_behavior_ids":["PB-11"],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-17","kind":"test","locator":{"kind":"test_case","name":"対象月予算IDを削除RPCに渡す"},"path":"apps/web/src/features/budgets/removeMonthlyBudget/removeMonthlyBudget.test.ts","product_behavior_ids":[],"requirement_id":"AC-1","verification_case_ids":["VC-12"]},{"id":"REP-18","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/removeMonthlyBudget/useRemoveMonthlyBudget.ts","product_behavior_ids":["PB-11"],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-19","kind":"test","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/removeMonthlyBudget/useRemoveMonthlyBudget.test.tsx","product_behavior_ids":[],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-20","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/removeMonthlyBudget/RemoveMonthlyBudgetModal/RemoveMonthlyBudgetModal.tsx","product_behavior_ids":["PB-11"],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-21","kind":"implementation","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/latestMonthlyBudget/LatestMonthlyBudget/LatestMonthlyBudget.tsx","product_behavior_ids":["PB-11"],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-22","kind":"test","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/updateMonthlyBudget/useUpdateMonthlyBudget.test.tsx","product_behavior_ids":[],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-23","kind":"configuration","locator":{"kind":"export","name":"Database"},"path":"apps/web/src/types/database.types.ts","product_behavior_ids":["PB-11"],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-24","kind":"test","locator":{"kind":"file"},"path":"apps/web/src/test/msw/handlers/monthlyBudgets.ts","product_behavior_ids":[],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-25","kind":"migration","locator":{"kind":"export","name":"invalid target rejection contract"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-12"],"requirement_id":"AC-2","verification_case_ids":["VC-13"]},{"id":"REP-26","kind":"migration","locator":{"kind":"export","name":"selected rule alignment contract"},"path":"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql","product_behavior_ids":["PB-13"],"requirement_id":"AC-3","verification_case_ids":["VC-14"]},{"id":"REP-27","kind":"test","locator":{"kind":"file"},"path":"apps/web/src/features/budgets/latestMonthlyBudget/LatestMonthlyBudget/LatestMonthlyBudget.test.tsx","product_behavior_ids":["PB-14"],"requirement_id":"AC-4","verification_case_ids":["VC-15","VC-16","VC-17","VC-18","VC-19"]}],"verification_cases":[{"id":"VC-1","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","selector":{"kind":"test_case","name":"月予算IDと金額をRPC引数に変換する","path":"apps/web/src/features/budgets/updateMonthlyBudget/monthlyBudgetUpdateMappers.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-2","procedure":"ローカルDBで別Bookまたは現在有効行と異なるIDをRPCへ渡し拒否を確認する","product_behavior_ids":["PB-2"],"requirement_id":"FR-2","type":"manual"},{"id":"VC-3","procedure":"ローカルDBで当月開始行IDを更新し同じ行の金額だけが変わることを確認する","product_behavior_ids":["PB-3"],"requirement_id":"FR-3","type":"manual"},{"id":"VC-4","procedure":"ローカルDBで過去有効行IDを更新し過去行不変と当月行追加を確認する","product_behavior_ids":["PB-4"],"requirement_id":"FR-4","type":"manual"},{"id":"VC-5","procedure":"ローカルDBで未来、stale、none、非所有IDの更新拒否と行不変を確認する","product_behavior_ids":["PB-5"],"requirement_id":"FR-5","type":"manual"},{"id":"VC-6","procedure":"ローカルDBで当月開始行IDを無効化し同じ行がnoneになることを確認する","product_behavior_ids":["PB-6"],"requirement_id":"FR-6","type":"manual"},{"id":"VC-7","procedure":"ローカルDBで過去有効行IDを無効化し過去行不変と当月none行追加を確認する","product_behavior_ids":["PB-7"],"requirement_id":"FR-7","type":"manual"},{"id":"VC-8","procedure":"ローカルDBで未来、stale、none、非所有IDの無効化拒否と行不変を確認する","product_behavior_ids":["PB-8"],"requirement_id":"FR-8","type":"manual"},{"id":"VC-9","procedure":"ローカルDBで更新と無効化の前後に過去月取得結果が同じことを確認する","product_behavior_ids":["PB-9"],"requirement_id":"NFR-1","type":"manual"},{"id":"VC-10","procedure":"ローカルDBでamountとnone制約およびunset取得結果が維持されることを確認する","product_behavior_ids":["PB-10"],"requirement_id":"NFR-2","type":"manual"},{"id":"VC-11","product_behavior_ids":["PB-11"],"requirement_id":"AC-1","selector":{"kind":"test_case","name":"対象月予算IDとamountを更新RPCに渡す","path":"apps/web/src/features/budgets/updateMonthlyBudget/updateMonthlyBudget.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-12","product_behavior_ids":[],"requirement_id":"AC-1","selector":{"kind":"test_case","name":"対象月予算IDを削除RPCに渡す","path":"apps/web/src/features/budgets/removeMonthlyBudget/removeMonthlyBudget.test.ts"},"type":"automated","verification_profile_id":"web-vitest-unit-integration"},{"id":"VC-13","procedure":"ローカルDBで全許可外record IDのRPC例外と行状態不変を確認する","product_behavior_ids":["PB-12"],"requirement_id":"AC-2","type":"manual"},{"id":"VC-14","procedure":"migrationの認可期間、record-ID境界、履歴遷移を固定済みruleと照合する","product_behavior_ids":["PB-13"],"requirement_id":"AC-3","type":"manual"},{"id":"VC-15","product_behavior_ids":["PB-14"],"requirement_id":"AC-4","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"web-unit-integration-suite"},{"id":"VC-16","product_behavior_ids":[],"requirement_id":"AC-4","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"web-typecheck"},{"id":"VC-17","product_behavior_ids":[],"requirement_id":"AC-4","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"web-lint"},{"id":"VC-18","product_behavior_ids":[],"requirement_id":"AC-4","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"web-format-check"},{"id":"VC-19","product_behavior_ids":[],"requirement_id":"AC-4","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"git-diff-check"}]}
```

## Rule Coverage

```json
{"additional_rules":[{"id":"ai-driven.workflow","reason":"apps実装pathへAIDD工程境界を適用するため"},{"id":"policy.git-workflow","reason":"appsとmigrationのtask-owned差分へgit境界を適用するため"},{"id":"policy.review-feedback-classification","reason":"apps変更のreview findingをscope別に分類するため"},{"id":"web.domain-layer-rules","reason":"budgets feature内のrecord-ID入力責務を配置するため"},{"id":"web.domain-ui-rules","reason":"月予算操作UIとdomain stateの境界を維持するため"},{"id":"web.msw-handlers","reason":"monthly budget RPC mock payloadを実装contractへ同期するため"},{"id":"web.storybook-browser-tests","reason":"apps/web pathに適用されるStorybook回帰境界を保持するため"}],"implementation_surfaces":["web-project","web-source","api-project"]}
```

## Design Coverage Gate

```json
{"baseline":{"body_sha256":null,"source":"none"},"baseline_sections":[],"coverage":[{"design_block_id":"fr-1-design","id":"FR-1","verification_block_id":"fr-1-verification"},{"design_block_id":"fr-2-design","id":"FR-2","verification_block_id":"fr-2-verification"},{"design_block_id":"fr-3-design","id":"FR-3","verification_block_id":"fr-3-verification"},{"design_block_id":"fr-4-design","id":"FR-4","verification_block_id":"fr-4-verification"},{"design_block_id":"fr-5-design","id":"FR-5","verification_block_id":"fr-5-verification"},{"design_block_id":"fr-6-design","id":"FR-6","verification_block_id":"fr-6-verification"},{"design_block_id":"fr-7-design","id":"FR-7","verification_block_id":"fr-7-verification"},{"design_block_id":"fr-8-design","id":"FR-8","verification_block_id":"fr-8-verification"},{"design_block_id":"nfr-1-design","id":"NFR-1","verification_block_id":"nfr-1-verification"},{"design_block_id":"nfr-2-design","id":"NFR-2","verification_block_id":"nfr-2-verification"},{"design_block_id":"ac-1-design","id":"AC-1","verification_block_id":"ac-1-verification"},{"design_block_id":"ac-2-design","id":"AC-2","verification_block_id":"ac-2-verification"},{"design_block_id":"ac-3-design","id":"AC-3","verification_block_id":"ac-3-verification"},{"design_block_id":"ac-4-design","id":"AC-4","verification_block_id":"ac-4-verification"}],"requirement_ids":["FR-1","FR-2","FR-3","FR-4","FR-5","FR-6","FR-7","FR-8","NFR-1","NFR-2","AC-1","AC-2","AC-3","AC-4"],"requirements_sha256":"b37c546132efc69783771d92cdc11ab9871fc47b733ca5c86974303736c5d182","workspace":"1516-write-1f0659ca8972"}
```

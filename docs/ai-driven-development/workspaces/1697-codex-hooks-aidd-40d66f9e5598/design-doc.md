---
title: "Design: Issue #1697 Codex Hooks AIDD safety net"
doc_type: design
status: proposed
area: repository
applies_to:
  - .codex
  - tools/aidd
topics:
  - ai-driven-development
  - codex-hooks
  - validation
  - design-doc
when_to_read:
  - Issue #1697のCodex Hooks実装と検証を行うとき
  - AIDD制御面のStopとcompact SessionStartの完成状態を確認するとき
---

# Design: Issue #1697 Codex Hooks AIDD safety net

- Requirements: `docs/ai-driven-development/workspaces/1697-codex-hooks-aidd-40d66f9e5598/requirements.json`
- Requirements SHA-256: `8e955c193afc1ddd5d2ff43425d5105128d330180634aa79af50dabaa848c5b4`
- Workspace: `1697-codex-hooks-aidd-40d66f9e5598`

## Architecture

repo-local hooks.jsonから既存checker Go module内のhook runnerを起動する。runnerはCodexのJSON stdinとGit差分だけを読み、Stopでは対象差分fingerprintに対する既存gate実行結果を派生cacheし、SessionStart compactでは固定された工程不変条件だけを返す。

FR\-1 design: Git HEADとの差分と非ignore untracked pathからAIDD制御面だけを選別し、該当時だけ既存checker test・phase contract・全成果物・diff整合性を検証する。

FR\-1 verification: 対象差分と対象外差分でvalidation runnerの呼出有無が分かれることをGo testで確認する。

FR\-2 design: 成功済みfingerprintは再生成可能cacheでskipし、失敗時はstop\_hook\_activeがfalseの一度だけ継続要求を返す。

FR\-2 verification: 同一fingerprintの成功skipとstop\_hook\_active\=true時の非blockをGo testで確認する。

FR\-3 design: SessionStart source\=compactだけに、現在Goal・親Goal所有・上流read\-only・BuildからShip・Learn非自動の固定contextを返す。

FR\-3 verification: compactとそれ以外のsource、および追加context全文をGo testで確認する。

NFR\-1 design: Hookは既存checker commandを固定argvで実行する補助層とし、cacheにはphaseやGoal状態を保存しない。

NFR\-1 verification: cache schemaとvalidation command一覧に第二の工程状態がないことをコードレビューで確認する。

NFR\-2 design: compact contextは5つの工程不変条件を定数として所有し、Issue本文・成果物・transcriptを読まない。

NFR\-2 verification: 追加contextが必要な5条件だけを含みIssueまたは成果物内容を含まないことをGo testで固定する。

NFR\-3 design: Hooks設定はrepo\-localの任意補助設定として追加し、既存AIDD入口とgateからHookへの依存を追加しない。

NFR\-3 verification: hooks\.jsonを無効または不在としても既存checker bootstrapとphase contractが成立する設計を確認する。

NFR\-4 design: hook runnerは既存checker Go moduleと標準ライブラリだけを使い、新しいmodule依存を追加しない。

NFR\-4 verification: go\.modとgo\.sumが不変であることを差分レビューで確認する。

AC\-1 design: Stop出力を対象外、成功、成功cache、失敗継続の決定結果へ正規化し、失敗理由にvalidation名を含める。

AC\-1 verification: 各決定結果とvalidation呼出回数をtable\-driven Go testで確認する。

AC\-2 design: Hook出力はCodexの継続または追加contextだけを指示し、checker成果物や判定値を生成・変更しない。

AC\-2 verification: Hookの書込先がrepository外cacheだけでcanonical gate出力を所有しないことをコードレビューで確認する。

AC\-3 design: 既存AIDD commandとphase agentはhooks\.jsonを参照せず、無効化時も同一の入口検証を実行する。

AC\-3 verification: Hook無効時の既存workflow非依存性を設定と呼出graphのレビューで確認する。

AC\-4 design: Go testは発火対象・対象外、成功・失敗、cache skip、再入防止、compact contextと設定shapeを網羅する。

AC\-4 verification: aidd\-checker\-tests profileで既存checker回帰を含む全Go testを成功させる。

## Target State

```json
{"ownership_scopes":[{"kind":"file","path":".codex/hooks.json"},{"kind":"tree","path":"tools/aidd/checker/cmd/aidd-hooks"},{"kind":"tree","path":"tools/aidd/checker/internal/codexhooks"}],"product_behaviors":[{"description":"AIDD制御面の差分がある停止時だけ必要な整合性検証が実行される","id":"PB-1","requirement_id":"FR-1","type":"state_transition"},{"description":"同一差分の成功検証は再実行されず再入済み失敗は追加継続されない","id":"PB-2","requirement_id":"FR-2","type":"state_transition"},{"description":"compact直後のmodel requestへ5つのAIDD工程不変条件が追加される","id":"PB-3","requirement_id":"FR-3","type":"state_transition"},{"description":"Hookは既存checker gateを補助しGoalまたはphase状態を所有しない","id":"PB-4","requirement_id":"NFR-1","type":"state_transition"},{"description":"compact contextは工程不変条件だけを含みIssue本文と成果物を含まない","id":"PB-5","requirement_id":"NFR-2","type":"state_transition"},{"description":"repo-local Hooksが無効または未信頼でも既存AIDD workflowは独立して動作する","id":"PB-6","requirement_id":"NFR-3","type":"state_transition"},{"description":"Hook runnerと回帰testは既存Go module内で新規外部依存なく動作する","id":"PB-7","requirement_id":"NFR-4","type":"state_transition"},{"description":"Stop判定が対象外と成功とcache skipと理由付き失敗継続へ分類される","id":"PB-8","requirement_id":"AC-1","type":"state_transition"},{"description":"Hook出力は既存workflowまたはcheckerの判定と成果物を上書きしない","id":"PB-9","requirement_id":"AC-2","type":"state_transition"},{"description":"Hooksを無効化した実行でも既存AIDD入口とphase gateが維持される","id":"PB-10","requirement_id":"AC-3","type":"state_transition"},{"description":"Hookの全発火分岐と再入とcompact contextがGo回帰testで固定される","id":"PB-11","requirement_id":"AC-4","type":"state_transition"}],"representations":[{"id":"REP-1","kind":"configuration","locator":{"kind":"file"},"path":".codex/hooks.json","product_behavior_ids":["PB-6"],"requirement_id":"NFR-3","verification_case_ids":["VC-6"]},{"id":"REP-2","kind":"implementation","locator":{"kind":"file"},"path":"tools/aidd/checker/cmd/aidd-hooks/main.go","product_behavior_ids":["PB-7"],"requirement_id":"NFR-4","verification_case_ids":["VC-7"]},{"id":"REP-3","kind":"implementation","locator":{"kind":"export","name":"HandleStop"},"path":"tools/aidd/checker/internal/codexhooks/hooks.go","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","verification_case_ids":[]},{"id":"REP-4","kind":"test","locator":{"kind":"test_case","name":"TestStopEvaluatesOnlyRelevantControlPlaneDiff"},"path":"tools/aidd/checker/internal/codexhooks/hooks_test.go","product_behavior_ids":[],"requirement_id":"FR-1","verification_case_ids":["VC-1"]},{"id":"REP-5","kind":"implementation","locator":{"kind":"export","name":"RetryDecision"},"path":"tools/aidd/checker/internal/codexhooks/hooks.go","product_behavior_ids":["PB-2"],"requirement_id":"FR-2","verification_case_ids":[]},{"id":"REP-6","kind":"test","locator":{"kind":"test_case","name":"TestStopSkipsCachedFingerprintAndPreventsReentry"},"path":"tools/aidd/checker/internal/codexhooks/hooks_test.go","product_behavior_ids":[],"requirement_id":"FR-2","verification_case_ids":["VC-2"]},{"id":"REP-7","kind":"implementation","locator":{"kind":"export","name":"HandleSessionStart"},"path":"tools/aidd/checker/internal/codexhooks/hooks.go","product_behavior_ids":["PB-3"],"requirement_id":"FR-3","verification_case_ids":[]},{"id":"REP-8","kind":"test","locator":{"kind":"test_case","name":"TestSessionStartCompactInjectsAIDDInvariants"},"path":"tools/aidd/checker/internal/codexhooks/hooks_test.go","product_behavior_ids":[],"requirement_id":"FR-3","verification_case_ids":["VC-3"]},{"id":"REP-9","kind":"implementation","locator":{"kind":"export","name":"RunValidations"},"path":"tools/aidd/checker/internal/codexhooks/hooks.go","product_behavior_ids":["PB-4"],"requirement_id":"NFR-1","verification_case_ids":["VC-4"]},{"id":"REP-10","kind":"implementation","locator":{"kind":"export","name":"CompactContext"},"path":"tools/aidd/checker/internal/codexhooks/hooks.go","product_behavior_ids":["PB-5"],"requirement_id":"NFR-2","verification_case_ids":[]},{"id":"REP-11","kind":"test","locator":{"kind":"test_case","name":"TestCompactContextContainsOnlyAIDDInvariants"},"path":"tools/aidd/checker/internal/codexhooks/hooks_test.go","product_behavior_ids":[],"requirement_id":"NFR-2","verification_case_ids":["VC-5"]},{"id":"REP-12","kind":"implementation","locator":{"kind":"export","name":"ControlPlaneFingerprint"},"path":"tools/aidd/checker/internal/codexhooks/hooks.go","product_behavior_ids":["PB-8"],"requirement_id":"AC-1","verification_case_ids":[]},{"id":"REP-13","kind":"test","locator":{"kind":"test_case","name":"TestStopReturnsTargetedValidationDecisions"},"path":"tools/aidd/checker/internal/codexhooks/hooks_test.go","product_behavior_ids":[],"requirement_id":"AC-1","verification_case_ids":["VC-8"]},{"id":"REP-14","kind":"implementation","locator":{"kind":"export","name":"HookOutput"},"path":"tools/aidd/checker/internal/codexhooks/hooks.go","product_behavior_ids":["PB-9"],"requirement_id":"AC-2","verification_case_ids":["VC-9"]},{"id":"REP-15","kind":"test","locator":{"kind":"test_case","name":"TestHooksDisabledLeavesWorkflowIndependent"},"path":"tools/aidd/checker/internal/codexhooks/hooks_test.go","product_behavior_ids":["PB-10"],"requirement_id":"AC-3","verification_case_ids":["VC-10"]},{"id":"REP-16","kind":"test","locator":{"kind":"test_case","name":"TestHookRegressionMatrix"},"path":"tools/aidd/checker/internal/codexhooks/hooks_test.go","product_behavior_ids":["PB-11"],"requirement_id":"AC-4","verification_case_ids":["VC-11"]}],"verification_cases":[{"id":"VC-1","product_behavior_ids":["PB-1"],"requirement_id":"FR-1","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"aidd-checker-tests"},{"id":"VC-2","product_behavior_ids":["PB-2"],"requirement_id":"FR-2","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"aidd-checker-tests"},{"id":"VC-3","product_behavior_ids":["PB-3"],"requirement_id":"FR-3","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"aidd-checker-tests"},{"id":"VC-4","procedure":"Hookのcacheと実行commandにGoalまたはphaseの正本がないことを確認する","product_behavior_ids":["PB-4"],"requirement_id":"NFR-1","type":"manual"},{"id":"VC-5","product_behavior_ids":["PB-5"],"requirement_id":"NFR-2","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"aidd-checker-tests"},{"id":"VC-6","procedure":"Hooks無効時も既存AIDD入口がhooks設定を参照しないことを確認する","product_behavior_ids":["PB-6"],"requirement_id":"NFR-3","type":"manual"},{"id":"VC-7","procedure":"go.modとgo.sumに新規依存差分がないことを確認する","product_behavior_ids":["PB-7"],"requirement_id":"NFR-4","type":"manual"},{"id":"VC-8","product_behavior_ids":["PB-8"],"requirement_id":"AC-1","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"aidd-checker-tests"},{"id":"VC-9","procedure":"Hookがcanonical checker出力を書き換えないことを確認する","product_behavior_ids":["PB-9"],"requirement_id":"AC-2","type":"manual"},{"id":"VC-10","procedure":"Hook無効化が既存workflowの実行条件を変えないことを確認する","product_behavior_ids":["PB-10"],"requirement_id":"AC-3","type":"manual"},{"id":"VC-11","product_behavior_ids":["PB-11"],"requirement_id":"AC-4","selector":{"kind":"suite"},"type":"automated","verification_profile_id":"aidd-checker-tests"}]}
```

## Rule Coverage

```json
{"additional_rules":[],"implementation_surfaces":[]}
```

## Design Coverage Gate

```json
{"baseline":{"body_sha256":null,"source":"none"},"baseline_sections":[],"coverage":[{"design_block_id":"fr-1-design","id":"FR-1","verification_block_id":"fr-1-verification"},{"design_block_id":"fr-2-design","id":"FR-2","verification_block_id":"fr-2-verification"},{"design_block_id":"fr-3-design","id":"FR-3","verification_block_id":"fr-3-verification"},{"design_block_id":"nfr-1-design","id":"NFR-1","verification_block_id":"nfr-1-verification"},{"design_block_id":"nfr-2-design","id":"NFR-2","verification_block_id":"nfr-2-verification"},{"design_block_id":"nfr-3-design","id":"NFR-3","verification_block_id":"nfr-3-verification"},{"design_block_id":"nfr-4-design","id":"NFR-4","verification_block_id":"nfr-4-verification"},{"design_block_id":"ac-1-design","id":"AC-1","verification_block_id":"ac-1-verification"},{"design_block_id":"ac-2-design","id":"AC-2","verification_block_id":"ac-2-verification"},{"design_block_id":"ac-3-design","id":"AC-3","verification_block_id":"ac-3-verification"},{"design_block_id":"ac-4-design","id":"AC-4","verification_block_id":"ac-4-verification"}],"requirement_ids":["FR-1","FR-2","FR-3","NFR-1","NFR-2","NFR-3","NFR-4","AC-1","AC-2","AC-3","AC-4"],"requirements_sha256":"8e955c193afc1ddd5d2ff43425d5105128d330180634aa79af50dabaa848c5b4","workspace":"1697-codex-hooks-aidd-40d66f9e5598"}
```

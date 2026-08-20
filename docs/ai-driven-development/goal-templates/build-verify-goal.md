---
title: Build / Verify Goal Template
doc_type: template
status: accepted
area: repository
applies_to:
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - implementation
  - verification
when_to_read:
  - Build / Verify Goalを構築するとき
---

# Build / Verify Goal

## Goalへ含める情報

- 目的: validation済みRequirementsとDesignの全scopeを実装し検証する。
- Cycle identity: Issue、workspace、branch、artifact pathsとhashes。
- Read-only inputs: canonical RequirementsとDesign、および生成Markdown。
- Scope: 変更してよい領域、変更しない領域、全Requirement ID、影響するapp。
- Rule selection: 関連policy、ADR、domain rule、test guidance。
- Implementation context: 関連コード、既存pattern、tests、known risks。
- Verification: 対象appについてAGENTS.mdが定義する具体的command。

## Done

- 全RequirementとDesign decisionを満たす実装が完了している。
- 必要なcode、test、fixture、doc表現が同期している。
- 対象appの必須verificationが現在diffに対して成功している。
- 未解消のlint、type、test、整合性、scope漏れがない。

## Stop

- RequirementsまたはDesignの不足・矛盾を推測で埋める必要がある。
- 明示scopeや権限を越える変更が必要。
- 必須verificationが外部条件のため完了不能。

成功時の次工程はShipです。上流成果物はこのGoal内で変更しません。

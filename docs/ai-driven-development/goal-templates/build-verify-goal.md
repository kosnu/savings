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
- Cycle identity: Issue、workspace、branch、Design完了証拠のreceipt pathとSHA-256。cycle-start titleは検証済みRequirementsとreceiptからのみ取得し、Build入力として再指定しない。
- Entry validation: Build entry gateが記録SHA-256に一致するreceipt bytesをidentityとして読み込み、現在のIssue snapshot、canonical Requirements / Design、両生成Markdown、canonical rule map、選択済みrule文書の同一byte snapshotを再検証し、receiptの全pathとhashに一致した結果。
- Read-only inputs: canonical RequirementsとDesign、生成Markdown、Design completion receipt。検証中の比較には読み込み済みreceipt bytesを使い、receipt pathの継続占有をidentityとはしない。
- Scope: 変更してよい領域、変更しない領域、全Requirement ID、typed product behavior inventory、影響するapp。
- Rule selection: 関連policy、ADR、domain rule、test guidance。
- Implementation context: 関連コード、既存pattern、tests、known risks。
- Verification: 対象appについてAGENTS.mdが定義する具体的command。

## Done

- 全RequirementとDesign decisionを満たす実装が完了している。
- 必要なcode、test、fixture、doc表現が同期している。
- 対象appの必須verificationが現在diffに対して成功している。
- receiptのGit基準点から実際の変更pathをmachine review surfaceへ自動分類し、canonical Build rule coverage recordに未解決がない。
- Build entry gateを再実行し、Goalへ記録したreceipt SHA-256と一致している。
- 未解消のlint、type、test、整合性、scope漏れがない。

## Stop

- Build entryのartifact gateまたはrender同期が失敗する。
- RequirementsまたはDesignの不足・矛盾を推測で埋める必要がある。
- typed inventoryにないproduct behaviorが実装に必要になる。
- 実差分に未宣言surface、receiptにない必須rule、またはsurface未定義のgoverned pathがある。
- 明示scopeや権限を越える変更が必要。
- 必須verificationが外部条件のため完了不能。

成功時の次工程はShipです。上流成果物はこのGoal内で変更しません。

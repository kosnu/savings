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
- Scope: receiptに固定したownership scope、全Requirement ID、target state、baseline inventory、影響するapp。
- Rule selection: 関連policy、ADR、domain rule、test guidance。
- Implementation context: 関連コード、既存pattern、tests、known risks。
- Verification: 対象appについてAGENTS.mdが定義する具体的command。

## Done

- target stateだけを実体化し、既存実装のtask-owned範囲をその完成状態へ再構成している。
- 必要なcode、test、fixture、doc表現が同期している。
- 対象appの必須verificationが現在diffに対して成功している。
- 全`VC-*`にcase type別の構造化成功証拠があり、automated evidenceはDesign固定command、exit code 0、出力hashに一致し、必須representationが存在し、task-owned範囲に未登録path・export・test caseが残っていない。`test_case`はrepository承認runner `vite-plus/test`から非aliasで直接importした`test`/`it`へ登録し、同名bindingをshadowせず、`only`/`skip`/`todo`/`fails`を使わない。`each`は静的に非空なarray tableに限る。
- receiptのGit基準点から実際の変更pathを分類し、全変更がownership scopeまたは固定workflow evidence path内にあり、path ruleと依存closureを含むcanonical Build rule coverage recordに未解決がない。
- Build entry gateを再実行し、Goalへ記録したreceipt SHA-256と一致している。
- 未解消のlint、type、test、整合性、scope漏れがない。

## Stop

- Build entryのartifact gateまたはrender同期が失敗する。
- RequirementsまたはDesignの不足・矛盾を推測で埋める必要がある。
- target stateにないproduct behavior、verification case、representationが必要になる。
- task-owned範囲に不純物が残る、または実差分がownership scopeを越える。
- 実差分に未宣言surface、receiptにないsurface必須rule・path一致rule・依存node、またはsurface未定義のgoverned pathがある。
- 明示scopeや権限を越える変更が必要。
- 必須verificationが外部条件のため完了不能。

成功時の次工程はShipです。上流成果物はこのGoal内で変更しません。

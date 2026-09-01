Issue #1516の最新本文全体を、月予算writeの責務境界と状態遷移を一意に定める検証可能なRequirementsへ変換する。

## Cycle Identity

- Cycle-start Issue title: 月予算writeの責務分離を再設計する

## Requirements Input Gate

```json
{"depends_on":[{"id":"architecture.overview","via":"policy.transaction-boundaries"},{"id":"domain.amount","via":"domain.monthly-budget"},{"id":"domain.date","via":"domain.monthly-budget"},{"id":"policy.temporal-data","via":"domain.monthly-budget"}],"direct_rules":[{"explicit_surface":"rpc","id":"policy.transaction-boundaries","issue_evidence":"月予算の更新RPC","match":{"field":"topics","value":"rpc"},"reason":"authenticated userが直接呼び出す更新境界の責務を定義するため"},{"id":"domain.monthly-budget","issue_evidence":"`monthly-budget`","match":{"field":"topics","value":"monthly-budget"},"reason":"月予算の更新・無効化状態遷移を定義するため"}],"task_context":{"body_sha256":"e74ac5389fc23e1200d436857264a540037b7d283278b8eda3b949eb06b4ea3e","issue":"kosnu/savings#1516","source":"issue_body","updated_at":"2026-09-01T01:20:09Z","url":"https://github.com/kosnu/savings/issues/1516"}}
```

## Requirements Completeness Gate

```json
{"baseline":{"body_sha256":"b37c546132efc69783771d92cdc11ab9871fc47b733ca5c86974303736c5d182","source":"git_head"},"issue_body_sha256":"e74ac5389fc23e1200d436857264a540037b7d283278b8eda3b949eb06b4ea3e","requirements":[{"id":"FR-1","issue_evidence":null,"status":"unchanged"},{"id":"FR-2","issue_evidence":null,"status":"unchanged"},{"id":"FR-3","issue_evidence":null,"status":"unchanged"},{"id":"FR-4","issue_evidence":null,"status":"unchanged"},{"id":"FR-5","issue_evidence":null,"status":"unchanged"},{"id":"FR-6","issue_evidence":null,"status":"unchanged"},{"id":"FR-7","issue_evidence":null,"status":"unchanged"},{"id":"FR-8","issue_evidence":null,"status":"unchanged"},{"id":"NFR-1","issue_evidence":null,"status":"unchanged"},{"id":"NFR-2","issue_evidence":null,"status":"unchanged"},{"id":"AC-1","issue_evidence":null,"status":"unchanged"},{"id":"AC-2","issue_evidence":null,"status":"unchanged"},{"id":"AC-3","issue_evidence":null,"status":"unchanged"},{"id":"AC-4","issue_evidence":null,"status":"unchanged"}],"retired":[],"sections":[{"id":"background","issue_evidence":null,"status":"unchanged"},{"id":"users","issue_evidence":null,"status":"unchanged"},{"id":"stories","issue_evidence":null,"status":"unchanged"},{"id":"scope","issue_evidence":null,"status":"unchanged"},{"id":"functional","issue_evidence":"クライアントは対象レコードIDと操作内容を渡す","status":"changed"},{"id":"non-functional","issue_evidence":"既存の月予算状態モデル amount / none / unset は変えない","status":"changed"},{"id":"acceptance","issue_evidence":"未来月開始レコードや現在有効でないレコードへの current write が拒否される","status":"changed"},{"id":"qa","issue_evidence":null,"status":"unchanged"},{"id":"technical","issue_evidence":null,"status":"unchanged"}],"workspace":"1516-write-1f0659ca8972"}
```

## 背景

authenticated userがSupabase RPCを直接呼び出せるため、クライアント指定月を許可根拠にするとUI文脈と write permission の責務が混ざる。

## 対象ユーザーと利用シーン

認証済み利用者は表示中の月予算に対する操作意図を送ることで、安全に更新または無効化する。

## ユーザーストーリー

利用者として、対象月を許可入力として指定せず、対象レコードとアプリケーション境界の現在月から処理が決まることで、履歴を壊さず当月の予算を変更したい。

## スコープ

対象は月予算の更新RPC、月予算の削除/無効化RPC、Web側呼び出し、責務分離ルールと関連テスト。対象外はカテゴリ予算、月予算外の時系列設計、timezone設計、Backend API層、UI表示変更。

## 機能要件

クライアントは対象レコードIDと操作内容を渡す。当月開始なら直接変更し、過去月開始で当月有効なら履歴を保つ当月開始レコードを生成し、許可外対象は拒否する。

- FR-1: クライアントは対象レコードIDと操作内容を渡す一方、\`target\_month\`または\`current\_month\`を月予算writeの入力にしない。
- FR-2: RPC は authenticated user が直接呼び出せる境界として扱うため、対象レコードの所有・有効状態と許可対象の現在月を境界内で判定する。
- FR-3: 更新時、当月開始の金額ありレコードなら、そのレコードの金額を更新する。
- FR-4: 更新時、過去月開始の金額ありレコードが当月にも有効なら、過去行を変更せず、当月開始の金額ありレコードを追加する。
- FR-5: 未来月開始のレコード、現在有効でないレコード、金額ありでないレコードは更新しない。
- FR-6: 削除または無効化時、当月開始の金額ありレコードなら、そのレコードを予算なし状態にする。
- FR-7: 削除または無効化時、過去月開始の金額ありレコードが当月にも有効なら、過去行を変更せず、当月開始の予算なしレコードを追加する。
- FR-8: 未来月開始のレコード、現在有効でないレコード、金額ありでないレコードは削除\/無効化しない。

## 非機能要件

既存の月予算状態モデル amount / none / unset は変えない。過去月の表示結果を維持し、タイムゾーンによる現在月定義は別論点として扱う。

- NFR-1: 過去月の表示結果を変更してはいけないため、履歴行を遡及更新しない。
- NFR-2: 既存の月予算状態モデル amount \/ none \/ unset は変えない。タイムゾーンによる現在月の定義変更とBackend API層追加も対象外とする。

## 受け入れ条件

未来月開始レコードや現在有効でないレコードへの current write が拒否されること、クライアント月入力なしのwrite、過去月履歴の維持、ルール同期と回帰検証を確認する。

- AC-1: クライアントが \`target\_month\` や \`current\_month\` を渡さずに更新・削除\/無効化できる。
- AC-2: RPCで未来月開始レコードや現在有効でないレコードへの current write が拒否される。
- AC-3: 責務分離が \`monthly\-budget\` domain rule と関連 policy にルール化されている。
- AC-4: 関連テストで既存の関連挙動が壊れていないことと必要な検証結果を確認できる。

## Q\&A

- Q: 月予算writeで何を分離するか。
  - A: クライアント入力、アプリケーション境界、DB/RPC の責務を識別したいというIssue意図に従い、操作意図と認可判定を分離する。

## 技術的考慮事項

クライアント由来の `current_month` を write permission の根拠にしない。RPCの直接呼び出しを含む境界で状態と期間を検証する。

## Rule Selection

- Direct: `policy.transaction-boundaries`。authenticated userが直接呼び出す更新境界の責務を定義するため。
- Direct: `domain.monthly-budget`。月予算の更新・無効化状態遷移を定義するため。
- Depends-on: `architecture.overview`（via `policy.transaction-boundaries`）。
- Depends-on: `domain.amount`（via `domain.monthly-budget`）。
- Depends-on: `domain.date`（via `domain.monthly-budget`）。
- Depends-on: `policy.temporal-data`（via `domain.monthly-budget`）。
- Conflict: none。

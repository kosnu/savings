---
title: "Requirements / PRD: 支払い画面の年月選択をオーバーレイ式にする"
doc_type: requirements
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
topics:
  - ai-driven-development
  - requirements
  - payments
  - month-selector
  - overlay
  - date
  - domain-ui
when_to_read:
  - Issue #1566 の年月選択改善を確認するとき
  - 支払い画面の対象月選択を設計するとき
---

# Requirements / PRD: 支払い画面の年月選択をオーバーレイ式にする

## 入力

- Cycle ID: `issue-1566-month-selector-overlay-20260801-03`
- Previous Cycle ID: `issue-1566-month-selector-overlay-20260801-02`
- Issue: [#1566 年月選択をオーバーレイ式に変更する](https://github.com/kosnu/savings/issues/1566)
- 関連 Issue: #1492（前月・翌月への移動）
- Canonical workspace: `docs/ai-driven-development/workspaces/1566-month-selector-overlay/`
- Task Context: 年月選択の一時面の表現は決め打ちせず正本ルールとの整合を確認し、既定と異なるダイアログ表現を採用する場合は、Requirementsに意図・成功条件、Designに選択根拠を明示する。

## 背景と課題

支払い画面では、対象月をURL search paramsの`year` / `month`で管理し、支払い一覧、月次サマリー、カテゴリ別集計を同じ年月の文脈で表示する。通常時の年月を1つの見やすい操作として示し、任意年月の選択を一時面へ分離することで、画面上部の情報量を抑えながら対象月を把握しやすくする。

これまでの学びから、年月表示と前後buttonの余白、選択完了時のcloseとfocus復帰、URL年月の境界、非同期テストの安定状態を要求として維持する。今回のTask Contextでは、一時面を特定componentやダイアログへ先に固定せず、プロダクトの正本ルールに照らして目的と内容量に合う表現を選ぶことを追加する。

## 期待する状態

通常時は現在の対象年月を現在言語に合う1つの見やすいtriggerで示し、前月・翌月buttonと適切な余白を持つ操作群として配置する。年月triggerからは、短い年月選択という目的と内容量に合い、Web Design Rulesと整合する一時面を開く。

一時面内では、通常時より大きく操作しやすい年・月の選択欄を使用できる。年または月の選択が対象月へ反映された時点を選択完了とし、一時面を閉じて元の年月triggerへfocusを戻す。URLの対象月、カテゴリ絞り込み、前月・翌月操作は既存経路と一貫する。

不正または未解決のURL年月を新しい表示経路へ渡しても、クラッシュや矛盾した年月表示にせず、既存のURL初期化・正規化境界と整合する。テストは非同期処理の途中状態ではなく、期待する安定状態を検証する。

## 対象ユーザーと利用シーン

- 対象ユーザー: Savingsの支払い画面で月ごとの支払いを確認する認証済みユーザー。
- 対象月確認: 支払い一覧や月次サマリーが何年何月の情報かを短時間で把握する。
- 任意年月選択: 隣接月以外を確認するとき、年月triggerから一時面を開いて年または月を選ぶ。
- 連続確認: 前月・翌月buttonを使い、必要な場合だけ任意年月選択を開く。
- キーボード操作: 選択完了またはdismiss後に元の年月triggerから操作を続ける。
- URL復元: 保存・共有・直接入力された年月URLから、安全に支払い画面を表示する。

## ユーザーストーリー

- 認証済みユーザーとして、現在見ている年月を1つの表示で把握したい。
- 認証済みユーザーとして、年月表示と前後移動を判別しやすい間隔で操作したい。
- 認証済みユーザーとして、年月選択の目的と内容量に合う一時面から年月を選びたい。
- 認証済みユーザーとして、年月を選び終えたら一時面が閉じ、選択結果をすぐ確認したい。
- キーボード利用者として、一時面が閉じた後に元の年月triggerへ戻りたい。
- 認証済みユーザーとして、不正または初期化途中の年月URLでも画面がクラッシュせず、既存のURL処理と一貫した状態になってほしい。

## スコープ

### 対象

- `/payments`の現在年月triggerと前月・翌月buttonの操作群。
- 年月triggerから開く、正本ルールと整合する年月選択の一時面。
- 一時面内の年と月の選択欄。
- 選択完了時のcloseと年月triggerへのfocus復帰。
- 選択結果の`year` / `month` search paramsと支払い画面への反映。
- 年月URLの正常値、境界値、不正値、未解決状態と既存経路の整合。
- 関連する回帰テストと非同期テストの安定状態検証。

### 対象外

- 前月・翌月機能の再実装または仕様変更。
- 選択可能な年月範囲の変更。
- 支払い、カテゴリ、予算のデータ構造や集計ロジックの変更。
- DB、API、認証、権限、RLS、RPCの変更。
- 支払い画面以外の年月選択体験の変更。
- 新しい保存、確定、取消rollback操作の追加。
- このGoal内でのDesign Doc、実装、commit、push、PR更新。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `requirements.md`, `/payments`の年月選択
  - domain: `date`, `payment`, `category`, `web-ui`, `test`
  - activity: `refine_requirements`, `change_payment_ui`, `change_dialog`, `review_test_gap`
  - topic: `requirements`, `month`, `overlay`, `focus`, `URL`, `regression`
- Selected:
  - `ai-driven.workflow`: 新cycleと成果物のread/write境界。
  - `ai-driven.issue-guidelines`: Issue #1566を意図と境界の入力として扱う。
  - `documentation.policy`: canonical文書形式。
  - `web.design-system-brand`: 一時面と通常画面の視覚方針。
  - `web.design-rules`: 一時面の目的別表現、ボタン群の余白、close、focus、responsive。
  - `web.domain-ui-rules`: 対象月の利用目的と不正・未解決状態。
  - `web.test-policy`: 既存境界の監査、回帰テスト、非同期の安定状態。
  - `domain.date`: 対象月を年と月の組み合わせとして扱う。
  - `domain.payment`: 支払い画面の対象月境界を維持する。
- Depends-on: `ai-driven.overview`, `domain.amount`, `domain.category`。
- Conflict decision: Issue本文の「ダイアログ形式」は実装表現の固定として採用せず、最新Task ContextとWeb Design Rulesに従って目的・内容量からDesignで選択する。既定と異なるダイアログを採用するためのプロダクト意図・成功条件は、現入力にはない。

## Domain Value Intent

| 値 | 利用目的 | Requirements上の境界 |
| --- | --- | --- |
| 対象年月 | 表示中の支払い・月次サマリーの対象を識別する | 年と月の組み合わせとして、現在言語に合う1つのtriggerで示す。 |
| `year` / `month` | 支払い画面の検索条件を選ぶ | URL search paramsを正本として維持し、正常・境界・不正・未解決状態を既存処理と一貫させる。 |
| 年・月の選択値 | 任意の対象年月を指定する | 既存範囲内の選択を即時反映し、反映時点で選択完了とする。 |
| `category` | 支払いを絞り込む | 年月変更で解除・変更しない。 |
| 前月・翌月 | 隣接月へ移動する | 既存機能を維持し、任意年月選択に置き換えない。 |

## 機能要件

### FR-1: 通常時に対象年月を1つの操作として識別できる

- 現在の`year` / `month`と一致する年月を、現在言語に合う1つのtriggerとして表示する。
- 年と月を別々のselectとして常時表示しない。
- 年月triggerと前月・翌月buttonを1つのボタン群として扱い、Web Design Rulesの既定余白を適用する。

### FR-2: 正本ルールと整合する年月選択の一時面を開ける

- 年月triggerをクリック、タップ、キーボード操作すると年月選択の一時面を開く。
- 一時面の表現は先に決め打ちせず、Web Design Rulesの目的と内容量の分類に従う。
- 既定と異なるダイアログ表現は、Requirementsにプロダクト意図と検証可能な成功条件がある場合にだけDesignの候補にできる。このRequirementsには、その例外を採用する根拠を追加しない。
- 一時面はアクセシブルな名前とdismiss手段を持つ。

### FR-3: 一時面内で年月を選択し、完了できる

- 通常時より大きく操作しやすい年と月の選択欄を表示し、現在値を初期値にする。
- 選択可能範囲は既存の2022年1月から2032年12月までを維持する。
- 年または月を選択して対象月への反映が成立した時点で一時面を閉じる。
- 選択完了後と選択せずdismissした後のどちらも、元の年月triggerへfocusを戻す。

### FR-4: 選択結果を既存URL状態へ一貫して反映する

- 年または月の選択結果を`year` / `month` search paramsへ反映する。
- 通常時の年月表示、支払い一覧、月次サマリー、カテゴリ別集計が新しい対象月と矛盾しない。
- `category`を含む月以外のsearch paramsを維持し、別の対象月stateを追加しない。

### FR-5: URL年月の境界を安全に扱う

- 正常値、選択可能範囲の下限・上限、年またぎを既存経路と同じ結果で扱う。
- 不正な年・月、範囲外、片方だけ存在するURLで、クラッシュまたは矛盾した年月表示を起こさない。
- URL初期化・正規化が完了していない未解決状態を、確定済みの不正な年月として表示しない。
- 既存のURL初期化・validation・navigation境界をDesign / Planで監査し、利用範囲を広げる場合は不足する回帰テストを追加する。

### FR-6: 前月・翌月操作を維持する

- 前月・翌月buttonの年月範囲、年またぎ、URL更新、category保持を変えない。
- 任意年月選択の一時面は前月・翌月buttonを置き換えない。

## 非機能要件と制約

- trigger、一時面、年/月選択欄、dismiss操作はキーボードと支援技術から識別・操作できる。
- 一時面、余白、size、focusは最新のWeb Design Rulesと既存tokensに従う。
- モバイルを含む狭い画面で、横スクロールなしに年月を選択できる。
- 非同期に増減する要素数は、途中状態ではなく期待する安定状態まで待って検証する。
- 新規依存を追加しない。DB/API/Auth/RLS/RPCやドメイン仕様を変更しない。

## 受け入れ条件

- AC-1: 通常時に対象年月が現在言語に合う1つのtriggerとして見える。
- AC-2: 年月triggerと前月・翌月buttonにボタン群の既定余白がある。
- AC-3: 年月triggerから、Web Design Rulesの短い値選択に沿う一時面を開ける。
- AC-4: 一時面内で既存範囲の現在年月を、大きく操作しやすい年・月欄から選べる。
- AC-5: 年または月の選択がURLと画面へ反映された後、一時面が閉じて年月triggerへfocusが戻る。
- AC-6: dismiss操作でも一時面が閉じ、年月triggerへfocusが戻る。
- AC-7: 年月変更後もcategory、前月・翌月、年またぎ、上下限が維持される。
- AC-8: 正常、下限、上限、不正、範囲外、年か月だけのURLと初期化中の状態で、クラッシュや表示矛盾がなく既存URL処理と整合する。
- AC-9: API応答、対象月依存query、支払い画面外の年月選択利用箇所に契約変更がないことを監査で確認する。
- AC-10: 非同期の要素数を検証するテストが、期待する安定状態を待って判定する。
- AC-11: Webの必須検証と、一時面/focus/URL境界に必要なブラウザ寄りの検証が成功する。

## Q&Aログ

- Q: 一時面をcentered dialogまたは共通responsive overlayへ固定するか？
  - A: 固定しない。Web Design Rulesの短い値選択という目的と内容量に従い、Design / Planで正本に追跡できる表現を選ぶ。
- Q: 既定と異なるダイアログ表現をDesignで選べるか？
  - A: Requirementsにそのプロダクト意図と検証可能な成功条件がある場合だけ選べる。現入力には例外を採用する根拠がないため、このcycleのDesignで補わない。
- Q: 年と月を続けて変更できるよう一時面を開いたままにするか？
  - A: しない。年または月の選択が対象月へ反映された時点を選択完了とし、一時面を閉じる。
- Q: 選択完了時に保存または確定buttonを追加するか？
  - A: 追加しない。既存の即時URL反映を維持する。
- Q: 不正URLの新しい復帰操作を追加するか？
  - A: 追加を要求しない。既存のURL初期化・正規化境界との整合と、クラッシュ・表示矛盾の防止を要求する。

## 技術的考慮事項

- 現在の対象月は`/payments`の`year` / `month` search paramsが正本である。
- Design / Planは、年月選択を短い値選択としてWeb Design Rulesの表現分類へ対応付け、component選択の根拠を記録する。
- Design / Planで既定と異なるダイアログを採用する必要が生じた場合は、このRequirementsに意図・成功条件がないためStopする。
- Design / Planは、route search schema、URL初期化、年月変換、navigation、対象月依存queryの境界を実装前に監査する。
- Build / Verifyは、不正年月URLを含む不足する回帰テストと、安定状態を待つ非同期テストを維持または追加する。
- コンポーネントの追加、移動、抽出を伴う場合は、着手前にComponent Structure Policyを読む。

## Verification

このRequirements / PRD作成はdocumentation-onlyであり、アプリケーション検証コマンドは実行しない。Issue #1566、更新済みTask Context、最新のWeb Design Rules / Web Test Policy、選択したrule-mapサブグラフと照合する。

## Rule / Policy Check

- 更新済みTask ContextをFR-2、AC-3、Q&A、技術的考慮事項へ追跡できる。
- 一時面のcomponentをRequirementsで決め打ちせず、既定と異なるダイアログの判断境界を明示した。
- URL正本、category、前月・翌月、年月範囲、即時反映を維持する。
- 不正・未解決状態の安全性を要求し、根拠のない新しい復帰操作は追加していない。
- DB/API/Auth/RLS/RPC、データ構造、集計ロジック、新規依存の変更を要求していない。

## Stop条件

- 一時面の目的または選択完了の意味が複数解釈できる。
- 既定と異なるダイアログ表現が必要だが、そのプロダクト意図と成功条件がRequirementsにない。
- 既存のURL正本、category、前月・翌月、年月範囲と矛盾する。
- 支払い画面外の年月選択体験、API、DB、Auth、権限、ドメイン仕様の変更が必要になる。
- Issue #1566、Task Context、選択refsから追跡できない要求や成功条件が必要になる。
- Requirements / PRDが選択したルール・ポリシーに違反する、または違反の可能性がある。

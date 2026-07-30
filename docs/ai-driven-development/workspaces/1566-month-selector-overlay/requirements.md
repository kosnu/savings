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
  - dialog
  - date
  - domain-ui
when_to_read:
  - Issue #1566 の年月選択改善を確認するとき
  - 支払い画面の対象月選択を設計するとき
---

# Requirements / PRD: 支払い画面の年月選択をオーバーレイ式にする

## 入力

- Cycle ID: `issue-1566-month-selector-overlay-20260730-01`
- Issue: [#1566 年月選択をオーバーレイ式に変更する](https://github.com/kosnu/savings/issues/1566)
- 関連 Issue: #1492（前月・翌月への移動）
- Canonical workspace: `docs/ai-driven-development/workspaces/1566-month-selector-overlay/`

## 背景と課題

支払い画面では、対象月を URL search params の `year` / `month` で管理し、支払い一覧、月次サマリー、カテゴリ別集計を同じ年月の文脈で表示している。現行の `MonthSelector` は、前月・翌月ボタンの間に年と月の選択ボックスを常時並べている。

年と月が別々の小さな選択ボックスとして常時表示されるため、画面上部の要素が多くなり、現在表示している年月を1つの対象として把握しづらい。任意の年月を選ぶ操作も、通常時の表示と同じ小さな選択欄で行うため操作しづらい。

通常時の情報量を抑え、現在の対象年月を一目で識別できるようにしながら、必要なときだけ大きく操作しやすい年月選択を開ける状態にする。

## Current State / Current Gaps

- `/payments` の対象月は `year` / `month` search params が正本である。
- `year` / `month` が不足している場合は、既存の初期化処理が現在年月を補完する。
- 現在年月は、常時表示される年と月の2つの選択ボックスで表示・変更する。
- 年または月を選ぶと、その時点で `year` / `month` search params が更新される。
- 年月変更時は、`category` を含む月以外の search params を保持する。
- 前月・翌月ボタンは Issue #1492 で実装済みで、2022年1月から2032年12月までの既存範囲で動作する。
- 現在の対象年月を1つのまとまりとして読み取りにくく、任意年月選択の操作領域も小さい。

## 期待する状態

通常時は、現在選択している年月を現在の言語に合う1つの見やすい表示で示す。その表示は任意年月選択を開く操作でもあり、クリックまたはタップするとダイアログ形式のオーバーレイが開く。

ダイアログ内では、通常時より大きく操作しやすい年と月の選択欄を使用できる。年月の変更は既存どおり `year` / `month` search params へ反映し、カテゴリ絞り込みなど月以外の条件を維持する。ダイアログを閉じた後は、開く前の年月表示へフォーカスを戻す。

前月・翌月ボタンは維持し、隣接月への短い移動と任意年月選択を両立する。

## 対象ユーザーと利用シーン

- 対象ユーザー: Savings の支払い画面で月ごとの支払いを確認する認証済みユーザー。
- 対象月確認: 支払い一覧や月次サマリーが何年何月の情報かを短時間で把握する。
- 任意年月選択: 隣接月以外の年月を確認するとき、年月表示から選択ダイアログを開く。
- 絞り込み併用: カテゴリ絞り込みを維持したまま、確認対象の年月だけを変更する。
- 連続確認: 前月・翌月ボタンで隣接月へ移動し、必要な場合だけ任意年月選択を開く。

## ユーザーストーリー

- 認証済みユーザーとして、現在見ている年月を1つの表示で把握したい。そうすることで、支払い一覧と月次サマリーの対象を迷わず識別できる。
- 認証済みユーザーとして、年月表示をクリックまたはタップして年月選択を開きたい。そうすることで、通常時の画面をすっきり保ちながら任意の年月を選べる。
- 認証済みユーザーとして、大きく操作しやすい年と月の選択欄を使いたい。そうすることで、年月変更を行いやすくできる。
- キーボード利用者として、年月選択を閉じた後に元の年月表示へ戻りたい。そうすることで、続きの操作を見失わずに進められる。
- 認証済みユーザーとして、年月を変更してもカテゴリ条件と前月・翌月ボタンを引き続き使いたい。

## スコープ

### 対象

- `/payments` の通常時の現在年月表示。
- 現在年月表示をトリガーとするダイアログ形式のオーバーレイ。
- オーバーレイ内の年と月の選択欄。
- 選択した年月の `year` / `month` search params と支払い画面への反映。
- close後の年月表示へのフォーカス復帰。
- 現在言語に合う年月表記、カテゴリ条件、前月・翌月ボタンの維持。

### 対象外

- 前月・翌月への移動機能の再実装または仕様変更。
- 選択可能な年月範囲の変更。
- 支払い、カテゴリ、予算のデータ構造や集計ロジックの変更。
- DB、API、認証、権限、RLS、RPC の変更。
- 月以外の期間単位や年月比較機能の追加。
- 支払い画面以外で使われる年月選択の体験変更。
- この Goal 内での Design Doc作成、実装、commit、push、PR作成。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/1566-month-selector-overlay/requirements.md`, `apps/web/src/features/summaryByMonth/MonthSelector`, `apps/web/src/components/inputs/MonthPicker`
  - domain: `date`, `payment`, `category`, `web-ui`
  - activity: `refine_requirements`, `change_payment_ui`, `change_dialog`, `change_domain_ui`
  - topic: `requirements`, `month`, `payments`, `dialog`, `domain-ui`
- Selected:
  - `ai-driven.workflow`: Requirements工程と成果物境界を守るため。
  - `ai-driven.issue-guidelines`: Issue #1566 を意図と境界の入力として扱うため。
  - `documentation.policy`: canonical workspace文書の形式を守るため。
  - `web.design-system-brand`: 通常画面を落ち着かせ、一時面だけに奥行きを使う上位方針のため。
  - `web.design-rules`: dialog、操作要素、フォーカス復帰、responsiveの要求境界を確認するため。
  - `web.domain-ui-rules`: 年月を対象識別と検索条件の値として整理するため。
  - `domain.payment`: 支払い画面と月次支出の対象月境界を維持するため。
- Depends-on:
  - `ai-driven.overview`: AIDD工程の前提。
  - `domain.date`: 対象月を年と月の組み合わせで扱う前提。
  - `domain.amount`: 月次支出の値の意味を変えない前提。
  - `domain.category`: カテゴリ絞り込みの意味を変えない前提。
- Conflict decision: none.

## Domain Value Intent

| 値 | 利用目的 | Requirements上の境界 |
| --- | --- | --- |
| 対象年月 | 表示中の支払い・月次サマリーの対象を識別する | 年と月の組み合わせとして、現在言語に合う1つの表示で示す。 |
| `year` / `month` | 支払い画面の検索条件を選ぶ | URL search paramsを唯一の正本として維持し、別stateを追加しない。 |
| 年・月の選択値 | 任意の対象年月を指定する | 既存の即時反映と選択可能範囲を変えない。 |
| `category` | 特定カテゴリまたはカテゴリなしの支払いへ絞り込む | 年月変更で値を解除・変更しない。 |
| 前月・翌月 | 現在の対象月から隣接月へ移動する | Issue #1492 の既存機能を維持し、任意年月選択に置き換えない。 |

## 機能要件

### FR-1: 通常時に対象年月を1つの表示で識別できる

- 通常時は、現在選択している年と月を1つの見やすい表示として示す。
- 年と月を別々の選択ボックスとして常時表示しない。
- 表示は現在の言語に合う年月表記にする。
- 表示内容は `year` / `month` search params と一致する。

### FR-2: 年月表示から選択ダイアログを開ける

- 現在年月の表示はクリックまたはタップ可能な操作要素である。
- 操作すると、ダイアログ形式のオーバーレイを開く。
- ダイアログには目的を識別できるアクセシブルな名前を持たせる。
- ダイアログはユーザーが閉じられる。

### FR-3: ダイアログ内で年月を選択できる

- ダイアログ内に年と月の選択欄を表示する。
- 選択欄は通常時の現行選択ボックスより大きく、操作しやすい。
- 現在選択している年と月を初期値として示す。
- 選択可能な年月範囲と、選択時に対象年月へ反映する既存挙動を維持する。

### FR-4: 年月変更を既存URL状態へ反映する

- 年または月を選択した結果を `year` / `month` search paramsへ反映する。
- 選択後、通常時の年月表示と対象月に依存する支払い画面の情報は新しい年月と矛盾しない。
- 年月変更時に `category` を含む月以外の既存search paramsを維持する。
- 年月選択のための別の対象月stateを追加しない。

### FR-5: 閉じた後の操作位置を維持する

- ダイアログを閉じた後は、開く前の年月表示へフォーカスを戻す。
- フォーカス復帰は、選択後に閉じる場合と選択せず閉じる場合のどちらでも成立する。

### FR-6: 前月・翌月操作を維持する

- 既存の前月・翌月ボタンを通常時に引き続き使用できる。
- 前月・翌月ボタンの年月範囲、年またぎ、URL更新、カテゴリ条件保持の挙動を変えない。
- 任意年月選択は前月・翌月ボタンを置き換えない。

## 非機能要件と制約

- trigger、dialog、年/月選択欄、close操作はキーボードと支援技術から識別・操作できる。
- dialogの視覚表現は既存のRadix Themesとdesign tokensに従い、独自の色、shadow、角丸を追加しない。
- モバイルを含む狭い画面で、年月選択が横スクロールなしに操作できる。
- 既存依存の範囲で実現し、新規依存を追加しない。
- 既存の年月選択を使う支払い画面以外のUIへ見た目や操作の変更を波及させない。
- DB/API/Auth/RLS/RPC、支払い・カテゴリ・予算ドメインの仕様を変更しない。

## 受け入れ条件

- AC-1: `/payments?year=2025&month=5` の通常時に、年と月が別々の常時表示selectではなく、2025年5月を示す1つの操作要素として見える。
- AC-2: 現在年月の操作要素をクリックまたはタップすると、年月選択のdialogが開く。
- AC-3: dialog内に現在値を示す年と月の選択欄があり、通常時の現行selectより大きく操作しやすい。
- AC-4: 年または月を選択すると、既存範囲内で `year` / `month` search paramsと通常時の表示が選択結果へ更新される。
- AC-5: `/payments?year=2025&month=5&category=10` で年月を変更しても `category=10` が維持される。
- AC-6: dialogを閉じると、フォーカスが開く前の現在年月の操作要素へ戻る。
- AC-7: 既存の前月・翌月ボタン、年またぎ、下限/上限、カテゴリ条件保持が引き続き動作する。
- AC-8: 現在言語を変更すると、通常時の年月表示と選択肢がその言語に合う表記になる。
- AC-9: 支払い画面以外の `MonthPicker` 利用箇所の既存挙動と表示は変わらない。
- AC-10: DB/API/Auth/RLS/RPC、データ構造、月次集計ロジック、新規依存に差分がない。

## Q&Aログ

- Q: 前月・翌月機能も作り直すか？
  - A: 作り直さない。Issue #1492 で実装済みの機能を維持し、今回の対象は任意年月選択と通常表示の改善に限定する。
- Q: 年月を選択するまで `year` / `month` とは別の一時stateを正本にするか？
  - A: しない。対象月の正本は既存どおりURL search paramsである。選択時の即時反映を維持し、保存/確定という新しい操作は追加しない。
- Q: dialogを閉じる操作を新しいプロダクト要件として追加するか？
  - A: dismissibleなdialogとして閉じられることとfocus復帰を要求する。具体的なclose UIとdismiss方法はDesign / Planで既存dialog patternとdesign rulesに沿って決める。
- Q: 選択可能な年月範囲を広げるか？
  - A: 広げない。現行の2022年1月から2032年12月までを維持する。
- Q: 共通 `MonthPicker` の通常表示を大きくするか？
  - A: 支払い画面以外の利用箇所は対象外である。Design / Planでは既存利用箇所へ影響させず、dialog内だけを大きくする方針を決める。
- Q: mobileで全画面sheetにするか？
  - A: Issueは短い年月選択をdialog形式と定めている。新しいresponsive overlay判断は追加せず、短いcentered dialogとして狭い画面でも操作可能にする。

## 技術的考慮事項

- 現行 `MonthSelector` は `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.tsx` にあり、前月ボタン、`MonthPicker`、翌月ボタンを並べる。
- 現行 `MonthPicker` は `apps/web/src/components/inputs/MonthPicker/MonthPicker.tsx` にあり、支払い画面以外でも使われる。
- `MonthSelector` は `navigate({ to: "/payments", search: (prev) => ({ ...prev, year, month }) })` で月以外のsearch paramsを保持する。
- `MonthPicker` は年または月の選択ごとに `onChange` を呼び、`MonthSelector` がURLへ即時反映する。
- i18nは `getDateLocale` と `Intl.DateTimeFormat` を用いる既存実装がある。通常時の年月表示も現在言語に追従する必要がある。
- Radix Themesのdialog primitiveはfocus管理を提供するが、Build / Verifyでは実際にtriggerへfocusが戻ることをテストする。
- 実装がWebコンポーネントの追加、移動、抽出を伴う場合は、着手前に `apps/web/docs/policies/component-structure.md` を読む。

## Verification

このRequirements / PRD作成はdocumentation-onlyであり、アプリケーション検証コマンドは実行しない。Issue #1566、関連Issue #1492、現行 `MonthSelector` / `MonthPicker`、選択したrule-mapサブグラフと照合する。

## Rule / Policy Check

- Issue #1566の背景、期待状態、対象/対象外、制約、成功条件を要求へ追跡できる。
- 年月の利用目的を「表示対象の識別」と「支払い画面の検索条件の選択」に分けた。
- 既存のURL正本、カテゴリ条件、前月・翌月、即時反映、年月範囲を変更していない。
- dialogの具体的なcomponent構成、size、文言、test構成はDesign / Planへ残した。
- 新規依存、DB/API/Auth/RLS/RPC、データ構造、集計ロジックの変更を要求していない。

## Stop条件

- 通常時の年月表示、dialog内の選択、選択結果の反映に複数のプロダクト解釈が必要になる。
- 既存の即時反映、URL正本、カテゴリ条件、前月・翌月機能、年月範囲と矛盾する。
- 支払い画面以外の年月選択体験を変更する必要がある。
- Issue #1566、Task Context、選択refsから追跡できない要求や成功条件を追加する必要がある。
- 新規依存、DB/API/Auth/RLS/RPC、データ構造、集計ロジックの変更が必要になる。
- Requirements / PRDが選択したルール・ポリシーに違反する、または違反の可能性がある。

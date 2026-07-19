---
title: Profile Account Information Component Boundaries Requirements
doc_type: requirements
status: draft
area: web
applies_to:
  - apps/web/src/features/profile
topics:
  - profile
  - component-boundary
  - storybook
  - test
when_to_read:
  - Issue #1552のAccount Informationに対するレビュー指摘へ対応するとき
  - プロフィール機能のコンポーネント境界、Story、テスト責務を設計するとき
---

# Profile Account Information Component Boundaries Requirements

## Artifact Premise

この文書は、Issue #1552で実現を目指すプロフィールのAccount Informationについて、PR #1576のレビューで明らかになった独立確認、回帰検証、責務境界の不足を次のサイクルで解消するためのRequirements / PRDです。

表示名、メールアドレス、ログイン方法のプロダクト要件を拡張するものではありません。今回追加するのは、Issue #1552のユーザー体験を保ったまま、ユーザー向け責務と状態を独立して確認・検証できるようにするための非機能要件と制約です。

## Background / Current State

Issue #1552では、ユーザーが登録済みプロフィール情報とログイン情報を確認し、変更可能な情報を識別できないこと、および表示名を変更する手段がないことを課題としている。

PR #1576のレビューでは、次の不足が指摘された。

- Account Information自身のStoryがなく、Page Storyから表示されることが対象コンポーネントの独立したStoryとして扱われていた。
- コンポーネントテストが対象コンポーネントのStoryを基準に構成されていなかった。
- フォームの入力、validation、送信、送信結果という独立した責務が、親のデータ取得責務と同じコンポーネント境界に置かれていた。

これらの指摘を受け、component Storyの作成条件、Storyを再利用するテスト原則、責務によるコンポーネント切り出しが正本ポリシーに追加された。本Requirementsでは、そのポリシーをIssue #1552のAccount Informationへ適用するための達成条件を定義する。

## Goal

Account Informationのユーザー向け責務と状態が、それぞれ適切なコンポーネント境界で独立して確認でき、同じStoryを基準に回帰検証される状態にする。

## Target Users and Use Cases

### 対象ユーザー

- 自分のプロフィール情報とログイン情報を確認する認証済みユーザー
- 表示名を変更し、保存結果を確認する認証済みユーザー

### 利用シーン

- ユーザーが表示名、メールアドレス、ログイン方法を確認する。
- ユーザーが表示名を編集し、validation、送信中、成功または失敗を理解する。
- 開発者またはレビュー担当者が、Account Informationとフォームの通常状態・主要状態をページ全体から独立して確認する。
- テストがStoryと同じ前提条件からユーザー向け挙動を検証する。

## User Stories

- 認証済みユーザーとして、自分の登録情報とログイン情報を確認し、変更可能な情報を識別したい。
- 認証済みユーザーとして、表示名の入力から保存結果までの状態を理解したい。
- レビュー担当者として、Account Informationとフォームが担当する状態をそれぞれ独立して確認し、ページの他の責務に隠れた回帰を見落とさないようにしたい。

## Scope

### In Scope

- Account Informationの表示・取得状態を独立して確認できるStory境界
- 表示名フォームの入力、validation、送信、送信結果を独立して扱う責務境界
- Account Informationおよび切り出されたユーザー向けコンポーネント自身のStory
- Storyを基準にしたコンポーネントテスト
- Storyを利用できずコンポーネントを直接テストする場合の理由の記録
- component StoryとStorybook browser test対象の区別

### Out of Scope

- 表示名、メールアドレス、ログイン方法の意味または編集可否の変更
- メールアドレスやログイン方法の変更機能
- アカウント削除、言語設定の仕様変更
- DB、API、認証方式、権限モデルの変更
- component Storyを一律にStorybook browser test対象へ加えること
- 具体的なファイル構成、コンポーネント名、props、provider、mock、テスト手順の決定
- Issue #1552にあるRetry focus、LanguageSelectとの操作分離、provider fallbackの詳細な再定義

## Domain Value Intent

| 値 | ユーザーが判断したいこと | 見せる目的 | 編集可否・制約 |
| --- | --- | --- | --- |
| 表示名（`name`） | アプリ内で現在使われる表示名と保存結果 | 値そのものを確認し、必要なら変更する | 編集可能。本人確認、権限、監査には使用しない |
| メールアドレス | 現在ログインしているアカウントの識別情報 | 値そのものを確認する | 読み取り専用 |
| ログイン方法 | どの認証方法でログインしているか | 認証方法を理解する | 読み取り専用 |

比較元、基準値、許可範囲、分類、期間は、この判断には不要とする。

## Functional Requirements

### FR-1 Account Information

- ユーザーは表示名、メールアドレス、ログイン方法を確認できる。
- 編集可能なのは表示名だけであり、メールアドレスとログイン方法は読み取り専用だと識別できる。
- 情報の取得中、取得失敗、正常表示をユーザーが区別できる。

### FR-2 Display Name Form

- ユーザーは表示名を入力し、validation結果を理解できる。
- ユーザーは保存中であることと、保存の成功または失敗を理解できる。
- フォームの入力、validation、送信、送信結果は、親のデータ取得責務とは別のユーザー向け責務として扱われる。

## Non-Functional Requirements and Constraints

### NFR-1 Component Responsibility

- 独立したフォーム状態と操作を持つ責務は、親と同じファイル内のprivate componentとして保持せず、独立したコンポーネント境界として扱う。
- loading、error、retryなど、親とは別に独立した状態または操作責務を持つコンポーネントも、`web.component-structure`の判断基準を適用する。
- 独立した状態や操作責務を持たない薄い描画断片まで、機械的に切り出すことは要求しない。

### NFR-2 Component Stories

- Account Informationは、対象コンポーネント自身を確認できるStoryを持つ。
- 責務により切り出されたユーザー向けコンポーネントは、それぞれ対象コンポーネント自身のStoryを持つ。
- Page Storyから子コンポーネントが表示されることを、子コンポーネント自身のStoryの代わりにしてはならない。
- Storyは少なくとも通常状態を持つ。loading、error、validation error、disabled、pendingなど、対象コンポーネントが所有し、ユーザーの判断または操作を変える永続的な状態も確認可能にする。

### NFR-3 Story-Based Tests

- コンポーネントテストは、原則として対象コンポーネントのStoryを再利用し、Storyと同じargs、provider、初期状態を基準にする。
- Storyを使わず対象コンポーネントを直接利用するテストには、Storyを再利用できない理由をコードコメントとして残す。
- テスト専用の一時的な内部条件を、Storyのユーザー向け責務へ持ち込まない。

### NFR-4 Storybook Browser Test Boundary

- component Storyを作成することだけを理由に、`browser-test` tagを付けない。
- browser test対象は、Pageまたは統合境界としての価値を`web.storybook-browser-tests`に照らして別途判断する。

### NFR-5 Regression Boundary

- 既存の言語設定を壊さない。
- Issue #1552で定めた表示内容、編集可能範囲、エラー理解を縮小または変更しない。

## Acceptance Criteria

- **AC-1:** ユーザーが表示名、メールアドレス、ログイン方法を確認し、表示名だけが編集可能だと識別できる。
- **AC-2:** ユーザーが取得中、取得失敗、正常表示、および表示名のvalidation、送信中、保存結果を理解できる。
- **AC-3:** Account Informationと表示名フォームの責務境界が分かれ、それぞれが所有するユーザー向け状態を独立して確認できる。
- **AC-4:** Account Information自身と、責務により切り出されたユーザー向けコンポーネント自身にStoryがあり、Page Storyで代替されていない。
- **AC-5:** 各Storyが通常状態と、そのコンポーネントが所有する主要な永続状態を表す。
- **AC-6:** コンポーネントテストが原則Storyを再利用する。直接利用するテストがある場合、その理由がテストコード内に記録されている。
- **AC-7:** component Storyは、browser test対象条件を満たすと別途判断された場合だけ`browser-test`対象になる。
- **AC-8:** 新しいユーザー操作、ドメイン値、DB／API／認証変更を追加せず、既存の言語設定を壊さない。

## Q&A Log

### Q1. Page StoryにAccount Informationが含まれていれば、component Storyを作成したことになるか

ならない。Page Storyはページまたは統合境界を確認するものであり、子コンポーネントの責務と状態を単独で確認するStoryを代替しない。

### Q2. 同じファイル内のprivate componentはすべて切り出すのか

切り出さない。フォーム状態、非同期状態、retry、focus管理など、親とは別のユーザー向け状態または操作責務を持つ場合に切り出す。薄い描画断片はprivate componentのままでよい。

### Q3. component Storyはすべてbrowser testにするのか

しない。component Storyの作成条件とbrowser testの対象条件は別に判断する。

### Q4. テストでStoryを使わないことは許容されるか

例外として許容される。Storyの責務を歪めないと表現できないAPI順序や一時的な内部条件など、再利用できない理由をテストコード内に記録する必要がある。

## Technical Considerations

- 具体的なコンポーネント名、配置、公開面、Story構成、test fixtureはDesign / Planで決定する。
- Design / Planでは、各状態の所有者を明示し、どのStoryとテストがどの受け入れ条件を担うか対応付ける。
- component Storyは通常のStorybookカタログで確認可能にし、browser test追加は統合境界の価値から判断する。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/**`, future scope `apps/web/src/features/profile/**`
  - domain: `ai-driven-development`, `web`, `ui`, `test`, `user`
  - activity: `write_prd`, `refine_requirements`, `split_component_responsibility`, `add_component_story`, `reuse_story_in_test`
  - topic: `requirements`, `profile`, `component-boundary`, `storybook`, `regression`
- Selected nodes:
  - `ai-driven.issue-guidelines` -> `docs/ai-driven-development/issue-guidelines.md`: Issueを最終要件へ展開する境界。
  - `documentation.policy` -> `docs/harness/policies/documentation-policy.md`: 新規Requirements文書。
  - `domain.user` -> `docs/harness/domain/user.md`: `name`だけを編集可能にするユーザー境界。
  - `web.feature-directory` -> `apps/web/docs/policies/feature-directory.md`: profile slice内の責務配置。
  - `web.component-structure` -> `apps/web/docs/policies/component-structure.md`: 責務分離とcomponent Story。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: Story再利用原則と例外コメント。
  - `web.storybook-browser-tests` -> `apps/web/docs/policies/storybook-browser-tests.md`: component Storyとbrowser testの境界。
- Depends-on nodes:
  - `ai-driven.overview` -> `docs/ai-driven-development/overview.md`: Goalと成果物の責務。
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: 新しいRequirementsサイクル。
  - `web.component-structure`: `web.feature-directory`の前提。
  - `web.test-policy`: `web.storybook-browser-tests`の前提。
- Conflict decision: 競合なし。

## Traceability

| Source | Requirements / Acceptance Criteria |
| --- | --- |
| Issue #1552の期待状態・成功条件 | FR-1, FR-2, NFR-5, AC-1, AC-2, AC-8 |
| StoryがないというPR #1576レビュー | NFR-2, AC-4, AC-5 |
| Storyをテストで使うというレビュー・監督入力 | NFR-3, AC-6 |
| フォーム責務をprivate componentにしないというレビュー | NFR-1, FR-2, AC-3 |
| `web.component-structure` | NFR-1, NFR-2, AC-3, AC-4, AC-5 |
| `web.test-policy` | NFR-3, AC-6 |
| `web.storybook-browser-tests` | NFR-4, AC-7 |
| `domain.user` | Domain Value Intent, FR-1, AC-1, AC-8 |

## Verification

- Requirements本文、Rule Selection、TraceabilityがIssue、レビュー、監督入力、選択ルールから逸脱していないことを確認する。
- Future behaviorをBackground / Current Stateで既存挙動として説明していないことを確認する。
- `git diff --check`を実行する。

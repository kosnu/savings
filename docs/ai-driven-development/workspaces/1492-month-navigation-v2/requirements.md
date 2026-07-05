# 月単位画面の月送り範囲とフィルタ保持 Requirements

## Source

- Original Issue: [#1492 月単位画面で前月・翌月へ移動しやすくする](https://github.com/kosnu/savings/issues/1492)
- Feedback source: [PR #1536 月送り操作を追加](https://github.com/kosnu/savings/pull/1536) の未解決 review threads
- Oversight input: 将来案「最小は支払い情報の年月、最大は支払い情報の年月 + 1年」は未確定のため、Requirements、ルール、Issue記載には含めない。

## Rule Selection

作業分類:

- path: `docs/ai-driven-development/workspaces/1492-month-navigation-v2/requirements.md`
- domain: repository, ai-driven-development, date, payment, category
- activity: write_prd, prepare_next_requirements_input, classify_review_feedback
- topic: requirements, review, month, payment, category, test

Selected refs:

- `docs/harness/rule-map.json`: 関連ドキュメント選択の入口。
- `docs/harness/policies/documentation-policy.md`: docs配下に新規Requirements artifactを追加するため。
- `docs/ai-driven-development/workflow.md`: 新サイクルをRequirementsから始め、既存 generated artifact を read-only とするため。
- `docs/ai-driven-development/issue-guidelines.md`: IssueをRequirements入力として扱うため。
- `docs/harness/policies/review-feedback-classification.md`: Build / Verify完了後レビューを次Requirements入力として扱うため。
- `docs/harness/policies/temporal-data.md`: 月次状態、対象月、対象期間の境界をRequirementsで明示するため。
- `docs/harness/domain/date.md`: 対象月を年と月の組み合わせとして扱うため。
- `docs/harness/domain/payment.md`: 月次支払い表示と支払いカテゴリの任意性を確認するため。
- `docs/harness/domain/category.md`: category filter の意味とカテゴリ未設定の境界を確認するため。
- `apps/web/docs/policies/test-policy.md`: 任意項目も「存在しないこと」を検証期待に含めるため。

Depends-on refs:

- `docs/harness/policies/git-workflow.md`: review feedback classification の prerequisite。Git操作はこのRequirements作成の対象外。

Conflict decision: none.

## Background / Current State

月単位で支払い、予算、サマリーなどを確認する画面では、対象月を変更して月をまたいだ状態を見比べる操作が発生する。Issue #1492 では、前月・翌月へ続けて移動したいときに、現在の月変更導線だけでは操作が分かりにくい、または手間がかかる可能性があることが課題として示されている。

PR #1536 のレビューでは、月送り操作が既存の任意年月選択導線で扱える年範囲外へ移動すると、ユーザーが対象年月を理解したり再選択したりできない状態になり得ることが指摘された。また、月送り時の category filter は、存在する場合の保持だけでなく、存在しない場合に意図せず付与・残存しないことも検証対象にすべきと指摘された。

このRequirementsでは、前回実装コード、前回UI挙動、現在diff形状、前回実装由来の設計判断を根拠にしない。Issue、review feedback、oversight input、選択したルール・ポリシーから次サイクルの要求を整理する。

## Problem

ユーザーが月単位の情報を確認・変更するときに、対象月を前後へ移動しながら比較したい場合がある。月送り操作が対象月の表示、既存の月選択導線、URL/filter状態と矛盾すると、ユーザーは現在どの年月を見ているか、または元の条件を保ったまま月だけを移動できているかを判断しにくくなる。

特に、月送り可能範囲の境界が明確でない場合、選択できない対象月へ移動できてしまう可能性がある。category filter が任意であるにもかかわらず、月送り時に意図せず付与・残存すると、ユーザーが見ている支払い条件が変わったことに気づきにくい。

## Target Users And Use Cases

- 月単位で支払い、予算、サマリーを確認するユーザー。
- 前月・翌月の支払い状況や予算状況を連続して見比べたいユーザー。
- category filter などの既存条件を保ったまま、対象月だけを変更したいユーザー。
- filter 条件がない状態では、特定カテゴリに絞られていない月次情報を確認したいユーザー。

## Domain Value Intent

### 対象年月

- 利用目的: 対象を識別したい。前月・翌月へ移動した結果、どの年と月を見ているかを理解したい。
- 値そのものを見せたいのか、判断結果を見せたいのか: 年と月の実値を理解できる必要がある。
- 比較元、基準値、許可範囲、分類、期間を添える必要があるか: 現時点の月送り可能範囲は 2022年1月 〜 2032年12月。境界外へ移動できないことを判断できる必要がある。

### 月送り範囲

- 利用目的: 制約に違反していないか知りたい。月送り操作が扱える範囲内に収まっていることを確認したい。
- 値そのものを見せたいのか、判断結果を見せたいのか: Requirementsでは範囲の制約を定義する。具体的な表示方法はDesign / Planで決める。
- 比較元、基準値、許可範囲、分類、期間を添える必要があるか: 許可範囲は 2022年1月 〜 2032年12月。将来の動的範囲案は未確定のため含めない。

### category filter

- 利用目的: 分類を維持して月次情報を比較したい。filter がない場合は、分類で絞り込まれていないことを維持したい。
- 値そのものを見せたいのか、判断結果を見せたいのか: category がある場合はその条件が維持され、ない場合は存在しない状態が維持されることが重要。
- 比較元、基準値、許可範囲、分類、期間を添える必要があるか: category は支払いに対する任意条件であり、月送りによって新規付与・残存してはいけない。

## Scope

### In Scope

- 月送り機能の対象画面と対象外をRequirementsで明確にする。
- 前月・翌月へ移動する操作の期待挙動を整理する。
- 対象月表示、月送り操作、既存の任意年月選択導線の関係を整理する。
- 月送り可能範囲を 2022年1月 〜 2032年12月 として整理する。
- 範囲境界で対象年月が理解でき、再選択可能な状態に留まる要求を整理する。
- 月送り時に既存のURL/filter状態が矛盾しないことを整理する。
- category がある場合は保持し、ない場合は新規付与・残存しないことを受け入れ条件に含める。

### Out Of Scope

- 月次予算ドメインの仕様変更。
- 支払い、カテゴリ、予算データ構造の見直し。
- 新しい集計ロジックの追加。
- 月以外の期間単位への拡張。
- 具体的なボタン配置、component、実装手順、テストコードの書き方の固定。
- 将来案「最小は支払い情報の年月、最大は支払い情報の年月 + 1年」のRequirements化、ルール化、Issue記載。
- 既存 `docs/ai-driven-development/workspaces/1492-month-navigation/requirements.md` と `design-doc.md` の更新、整形、追記、リネーム。

## Functional Requirements

### FR-1: 対象画面と対象外の明確化

月送り機能を入れる対象画面と対象外をRequirementsで明確にする。対象画面が複数解釈でき、優先範囲を決められない場合はStopする。

### FR-2: 対象年月の理解

ユーザーは、月送り操作後も現在の対象年月を年と月の組み合わせとして理解できる必要がある。対象年月は、既存の任意年月選択導線と矛盾してはいけない。

### FR-3: 月送り可能範囲

前月・翌月操作で移動できる対象月の範囲は、現時点では 2022年1月 〜 2032年12月 とする。2022年1月より前、または2032年12月より後へは移動できない。

### FR-4: 範囲境界の扱い

範囲境界では、月送り操作によって対象年月が選択可能な範囲外になってはいけない。境界上でも、ユーザーが対象年月を理解し、任意年月選択導線で再選択可能な状態に留まる必要がある。

### FR-5: 既存条件との整合

月送り操作は、既存の月選択、filter、URL状態、データ取得境界と矛盾してはいけない。月だけを変更する意図の操作で、別の条件が意図せず増減してはいけない。

### FR-6: category filter の保持と非残存

月送り時、category filter が存在する場合は保持する。category filter が存在しない場合は、新規付与または残存しない。存在しないことも期待状態として扱う。

## Non-Functional Requirements / Constraints

- UI形状は既存のWeb UIパターンに合わせる。ただしRequirementsでは具体的なcomponentや配置を固定しない。
- 支払い、カテゴリ、予算データ構造を変更しない。
- DB、API、認証、権限モデルを変更しない。
- 対象月は年と月の組み合わせとして扱う。
- 月次表示の対象期間は、対象月の月初以上、翌月月初未満の支払いに基づく。
- テスト方針では、任意項目も「存在しないこと」を期待値として扱い、検証を省略しない。

## Acceptance Criteria

- [ ] 月送り機能の対象画面と対象外がRequirementsに明記されている。
- [ ] ユーザーが前月・翌月へ移動したい理由と期待挙動が整理されている。
- [ ] 対象年月、月送り操作、既存の任意年月選択導線の関係が整理されている。
- [ ] 月送り可能範囲が 2022年1月 〜 2032年12月 として明記されている。
- [ ] 2022年1月より前、または2032年12月より後へ月送りできないことが受け入れ条件になっている。
- [ ] 範囲境界でも対象年月を理解し、任意年月選択導線で再選択可能な状態に留まることが受け入れ条件になっている。
- [ ] category filter がある場合、月送り後も保持されることが受け入れ条件になっている。
- [ ] category filter がない場合、月送り後に新規付与・残存しないことが受け入れ条件になっている。
- [ ] 月送り時に既存の月選択、filter、URL状態、データ取得境界と矛盾しないことが受け入れ条件になっている。
- [ ] 既存の関連挙動が壊れていないことを確認する観点が整理されている。
- [ ] 将来の動的月送り範囲案がRequirementsに含まれていない。

## Q&A Log

### Q1. 月送り可能範囲はどう扱うか？

A. 現時点では 2022年1月 〜 2032年12月 とする。範囲外へ移動できないことをRequirementsに含める。

### Q2. 将来の動的範囲案は入れるか？

A. 入れない。最小を支払い情報の年月、最大を支払い情報の年月 + 1年にする案は未確定であり、Requirements、ルール、Issue記載の対象外とする。

### Q3. category filter は「ある場合の保持」だけでよいか？

A. よくない。category filter がない場合に、新規付与または残存しないことも期待状態として扱う。

### Q4. 具体的なボタン配置やcomponentを決めるか？

A. 決めない。Requirementsでは、ユーザーが対象年月、範囲境界、filter状態を理解できることを定義し、具体的なUI形状はDesign / Planで既存UIに合わせて決める。

## Technical Considerations

- Design / Planでは、月送り可能範囲と任意年月選択導線の扱える範囲が同期していることを確認する必要がある。
- Design / Planでは、範囲境界で月送り操作をどう扱うかを決める必要がある。ただしRequirementsでは、境界外へ移動できないことだけを要求する。
- Build / Verifyでは、category filter がある場合とない場合の両方を検証する必要がある。
- Build / Verifyでは、任意項目の期待値有無で検証を省略せず、存在しないことも期待状態として検証する必要がある。
- このRequirements作成はdocs-only変更であり、アプリ検証コマンドは不要。

## Rule / Policy Compliance Check

- `docs/ai-driven-development/workflow.md`: PR #1536 のBuild / Verify後レビューを前回実装への局所修正として扱わず、新しいRequirements入力に整理している。既存 generated artifact は更新していない。
- `docs/ai-driven-development/issue-guidelines.md`: Issue #1492 の意図、制約、対象外、成功条件を超えて、実装手順やcomponent指定へ広げていない。
- `docs/harness/policies/review-feedback-classification.md`: 未解決review threadsを次Requirements入力として分類し、実装修正やthread resolveは扱っていない。
- `docs/harness/policies/temporal-data.md` / `docs/harness/domain/date.md`: 対象月を年と月の組み合わせとして扱い、月送り可能範囲を明示している。
- `docs/harness/domain/payment.md` / `docs/harness/domain/category.md`: 支払いカテゴリを任意条件として扱い、category filter の保持と非残存をRequirementsに整理している。
- `apps/web/docs/policies/test-policy.md`: 任意項目も「存在しないこと」を期待値として扱い、検証を省略しない要求にしている。

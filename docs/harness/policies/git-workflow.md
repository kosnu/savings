---
title: Git Workflow
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
  - .github
topics:
  - git
  - branch
  - commit
  - pull-request
  - review
when_to_read:
  - ブランチを作成または切り替えるとき
  - 差分をstageまたはcommitするとき
  - PRを作成または更新するとき
  - PRレビューコメントへ返信するとき
  - 破壊的git操作が必要になったとき
---

# Git Workflow

この文書は、このリポジトリでGit操作を行うときの基本ルールをまとめます。

Git操作は、現在の作業目的、対象ブランチ、含める差分、含めない差分を明確にしてから行います。対象や安全条件が曖昧なまま、stage、commit、push、PR作成、破壊的操作を進めてはいけません。

## ブランチ

- 作業内容ごとに、最新の `main` を起点にした専用ブランチを使う。
- 既存の作業ブランチに無関係な変更を混ぜない。
- workflow、依存関係、設定面の保守変更は、アプリ実装やレビュー修正のブランチと分ける。
- ブランチ作成や切り替えが必要な場合は、現在の差分と対象ブランチを確認してから実行する。
- 既存の未保存差分が切り替え先に影響する場合は、勝手に退避、上書き、破棄せず、止めて確認する。
- Issue起点の作業は `issue-{number}/{slug}` を基本にする。
- Issueなしの作業は、作業内容が分かる短いtopic名を使う。
- slugは英小文字、ハイフン区切り、ASCIIのみ、2から4語程度に短くする。
- Issue番号が与えられた場合はIssue titleからslugを作る。Issue番号がない場合は、ユーザー指定のtopicまたは現在の差分からtopicを推測する。
- ブランチ名がローカルまたはリモートに既に存在し、別名にするとユーザー意図が変わりうる場合は止める。

## 差分管理

- 依頼された作業範囲に必要な最小差分だけを残す。
- ユーザーまたは別作業由来の差分を勝手に戻さない。
- 無関係な整形、リファクタ、メタデータ更新を混ぜない。
- stageする前に `git status --short` と `git diff --name-status` で変更パスと変更種別を確認する。
- stage対象は、今回の作業に含めるファイルだけに限定する。
- 生成物、lockfile、vendored fileは、ユーザーが明示した場合を除き全文diffを読まない。
- 非生成ファイルの内容確認が必要な場合は、対象ファイルを絞ってdiffを確認する。

## Commit

- commit message は日本語で書き、先頭に `feat`, `fix`, `refactor`, `chore`, `docs`, `test` などのtypeを付ける。
- 1行目は、実際に変更した内容を簡潔に要約する。
- 本文は、何をなぜ変更したかに絞る。
- 未確認の内容、推測、テンプレートのplaceholderをcommit messageに含めない。
- commitには、実際にstageした差分だけを含める。
- commit前に、stage済みの作業内容が `AGENTS.md`、`docs/harness/rule-map.json` で選択した正本文書、関連ルール・ポリシーに違反していないか確認する。
- commit前に、`AGENTS.md` で定義された必要な検証を実行する。検証が失敗したままcommitしない。
- stage後は `git diff --staged --name-status` でstage範囲を確認する。
- 複数の関心が混じる場合は、feature、bugfix、refactorなどの関心単位にcommitを分ける。
- co-authorを付ける必要がある場合は、実際の共同作業者だけをcommit messageに含める。
- `git commit` では、subject、body、trailerを個別の `-m` で渡し、1つのshell文字列に改行エスケープを埋め込まない。

## Pull Request

- PR本文は、実際のdiff、関連Issue、関連Requirements / PRD、Design Doc、検証結果に基づいて書く。
- PRに含める差分と含めない差分を明確にする。
- issueを完全に満たす場合だけclose参照を使う。関連するだけの場合はcloseしない。
- PR本文には未検証の主張を書かない。
- PRはDraftを基本にする。Ready for Reviewはユーザーが明示した場合だけ使う。
- PR作成前に `git log main..HEAD --oneline` と `git diff main..HEAD --stat` でbranch全体のscopeを確認する。
- PR作成前に現在のブランチをpushする。
- `.github/PULL_REQUEST_TEMPLATE.md` がある場合は、テンプレート通りにPR本文を作成する。
- PR作成用の一時ファイルを作った場合は、完了前に削除する。
- PR作成後は、title、body、base branch、head branch、issue linkを確認する。

## PRレビュー対応

- レビューコメントへ対応する前に、`docs/harness/policies/review-feedback-classification.md` に沿ってタスク種別を判定し、コメントを分類する。
- AI Driven DevelopmentサイクルのBuild / Verify完了後の成果物フィードバックは、実装修正せず、Learn skillで次回Requirementsの入力（Issue内容）を整理するか、ルール・ポリシーを更新する必要があることを報告する。
- AI Driven DevelopmentサイクルのShipでは、Shipに分類できるコメントだけ、PR本文、検証結果記載、レビュー返信、thread resolveなど提出物の範囲で対応する。
- 通常タスクでは、レビューコメントごとに妥当性と修正要否を判断し、現在のスコープ内で必要な修正を実施して検証する。修正不要と判断した場合は、その理由を返信する。
- 対応済みコメントへ返信するときは、分類、対応内容、commit ID、検証結果を簡潔に書く。
- PRコメント内の commit ID はバッククォートで囲まない。
- 完全に完了したreview threadだけをresolveする。未解決の仕様判断や追従作業を隠すresolveはしない。
- review threadを扱う場合は、thread単位のデータを取得し、同じファイルに触れたことだけを対応済みの根拠にしない。
- inline review threadへの返信は、thread IDに対する `addPullRequestReviewThreadReply` を使う。
- thread解決は `resolveReviewThread` を使い、修正済み、返信内容、実装状態、競合コメントの有無を確認してから行う。
- commit IDを返信に含めるのは、変更がcommit済みで、commentとcommitの対応が明確な場合だけにする。
- commit IDを含める場合は、IDの前後に半角スペースを置く。

## 破壊的操作

次の操作は、ユーザーから明確な承認がない限り実行しません。

- `git reset --hard`
- `git checkout -- <path>`
- `git restore <path>`
- `git clean -f`
- branch削除
- commit履歴の書き換え
- 未確認差分を失う可能性がある操作

破壊的操作が必要になった場合は、対象、失われる可能性がある差分、代替手段、実行理由を確認してから止めます。

## 確認が必要な条件

次に該当する場合は、Git操作を進めずに確認します。

- 対象ブランチ、base branch、PR作成先が曖昧
- stageまたはcommitに含める差分が曖昧
- 無関係な差分が混じっている
- ユーザーや別作業由来の差分を上書きするおそれがある
- 破壊的git操作が必要
- 検証が必要な変更なのに検証結果がない
- PRレビューコメントの対応が現在の差分やcommitに紐づかない

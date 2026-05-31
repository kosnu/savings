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
  - Design Docに従って実装と検証を行うとき
  - AIに実装作業を自律実行させるとき
---

# Build / Verify Goal

```md
# Build / Verify Goal

## Goal

最新のRequirements / PRDとDesign Docに従って実装し、検証まで完了する。

## Inputs

- Requirements / PRD:
- Design Doc:
- 関連Issue / PR:
- 対応するレビューコメント:

## Scope

- 対象リポジトリ:
- 対象ディレクトリ:
- 変更してよい領域:
- 変更しない領域:

## Autonomy

- 既存パターンに沿った実装判断は任せる
- 必要なテスト追加・修正は任せる
- 小さな型修正や呼び出し側調整は任せる
- 新規依存、DB変更、API仕様変更、破壊的git操作が必要になった場合はStop条件としてエスカレーションする

## Done

- [ ] PRDの受け入れ条件を満たしている
- [ ] Design Docの方針から逸脱していない
- [ ] レビューコメント起点の場合、修正前に工程分類し、Build / Verify対象だけを修正している
- [ ] 関連テストが追加・更新されている
- [ ] 指定の検証コマンドが通る
- [ ] 差分がスコープ内に収まっている
- [ ] PRで説明しやすい単位になっている

## Verification

- 必ず実行:
  - `pnpm run web:lint`
  - `pnpm run web:format-check`
  - `pnpm run web:typecheck`
  - `pnpm --filter web exec vp test run --project unit --project integration --reporter=dot --silent`
- 必要なら実行:
  - `pnpm --filter web test:storybook --reporter=dot --silent`
- 実行しない:
  -
- 手動確認:
  -

## Constraints

- 最小差分で対応する
- 無関係なリファクタをしない
- 既存の設計・命名・ディレクトリ構成に合わせる
- ユーザーに表示される主要文言はDesign Docで決まった内容から勝手に変えない
- 決定済みの上限値・閾値・文言内数値は二重管理しない
- 実装方式を変えたテストでは、旧方式の不要なmock、setup、expectationを残さない
- ユーザーの未コミット変更を戻さない
- 変更範囲外の問題は発見しても勝手に直さない
- 新しい抽象化は必要性が明確な場合だけ作る

## Stop

- レビューコメントがRequirements / PRD、Design Doc、またはpolicyへ戻すべき内容を含む
- Design Docまたは関連ドメインルールと違う実装が必要
- 実装に必要な主要文言がDesign Docで決まっていない
- スコープ外の変更が必要
- 受け入れ条件に矛盾がある
- 新規依存、DB変更、API仕様変更、破壊的git操作が必要
- 検証失敗が今回の変更と無関係
```

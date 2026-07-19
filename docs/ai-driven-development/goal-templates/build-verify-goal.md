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
  - review
when_to_read:
  - Design Docに従って実装と検証を行うとき
  - AIに実装作業を自律実行させるとき
---

# Build / Verify Goal

```md
# Build / Verify Goal

## Goal

最新のRequirements / PRDとDesign Docに従って実装し、検証まで完了する。

工程上の位置、入力境界、次工程、Ship完了後の扱いは [workflow.md](../workflow.md) を正本として従う。

## Inputs

- Requirements / PRD:
- Design Doc:
- 関連Issue / PR:
- Build / Verify工程中に発見した検証失敗・整合性問題:
- 関連ドキュメント:
  - docs/harness/rule-map.json で選択したサブグラフ:

## Scope

- 対象リポジトリ:
- 対象ディレクトリ:
- 変更してよい領域:
- 変更しない領域:

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- 作業分類:
  - path:
  - domain:
  - activity:
  - topic:
- Selected nodes: `id` -> `file`: reason
- Depends-on nodes: `id` -> `file`: reason
- Conflict decision: none / overrides / priority

## Autonomy

- 既存パターンに沿った実装判断は任せる
- 必要なテスト追加・修正は任せる
- 小さな型修正や呼び出し側調整は任せる
- Build / Verify工程中のテスト失敗、型エラー、lint、実装整合性、変更漏れは工程内で完了させる
- 新規依存、DB変更、API仕様変更、破壊的git操作が必要になった場合はStop条件としてエスカレーションする

## Done

- [ ] PRDの受け入れ条件を満たしている
- [ ] Design Docの方針から逸脱していない
- [ ] Requirements / PRDとDesign Docの意図・制約・対象外から解釈を広げていない
- [ ] `docs/harness/rule-map.json` で選択した関連ドキュメントから逸脱していない
- [ ] Build / Verify工程中に発見した検証失敗・整合性問題を工程内で解消している
- [ ] 関連テストが追加・更新されている
- [ ] 指定の検証コマンドが通る
- [ ] 差分がスコープ内に収まっている
- [ ] 実装差分と検証結果が、選択したルール・ポリシーに違反していないことを確認している
- [ ] PRで説明しやすい単位になっている

## Verification

- 検証前に実行:
  - `pnpm run web:format`
- 必ず実行:
  - `pnpm run web:lint`
  - `pnpm run web:format-check`
  - `pnpm run web:typecheck`
  - `pnpm run web:test:unit-integration`
- 必要なら実行:
  - `pnpm run web:test:storybook`
- 実行しない:
  -
- 手動確認:
  -

## Constraints

- 最小差分で対応する
- 無関係なリファクタをしない
- 既存の設計・命名・ディレクトリ構成に合わせる
- Requirements / PRDとDesign Docで決まっていない仕様、対象機能、成功条件を実装で補わない
- ユーザーに表示される主要文言はDesign Docで決まった内容から勝手に変えない
- 決定済みの上限値・閾値・文言内数値は二重管理しない
- 実装方式を変えたテストでは、旧方式の不要なmock、setup、expectationを残さない
- ユーザーの未コミット変更を戻さない
- 変更範囲外の問題は発見しても勝手に直さない
- 新しい抽象化は必要性が明確な場合だけ作る

## Stop

- Design Docまたは関連ドメインルールと違う実装が必要
- `docs/harness/rule-map.json` で選択した関連ドキュメントと違う実装が必要
- 実装中にRequirements / PRDまたはDesign Docの解釈を広げる必要がある
- 実装に必要な主要文言がDesign Docで決まっていない
- スコープ外の変更が必要
- 受け入れ条件に矛盾がある
- 実装差分または検証結果が選択したルール・ポリシーに違反している、または違反の可能性がある
- 新規依存、DB変更、API仕様変更、破壊的git操作が必要
- 検証失敗が今回の変更と無関係
```

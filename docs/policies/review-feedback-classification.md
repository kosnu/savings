---
title: Review Feedback Classification
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - review
  - pull-request
  - ai-driven-development
  - requirements
  - design
  - verification
when_to_read:
  - PRレビューコメントに対応するとき
  - 未解決review threadを確認するとき
  - レビューコメントをRequirements / PRD、Design / Plan、Build / Verify、Ship / Learnに分類するとき
---

# Review Feedback Classification

PRレビューコメントに対応するときは、最初に工程分類します。

分類前に実装修正を始めると、仕様判断や設計判断を Build / Verify の小修正として吸収してしまい、PRDやDesign Docとの接続が崩れます。

## 分類

- Requirements / PRD: 何を達成すべきか、対象外、成功条件、ユーザー体験、受け入れ条件に関わるコメント
- Design / Plan: データ構造、責務境界、API / DB / 認証 / 権限、移行方針、検証方針に関わるコメント
- Build / Verify: 決定済みの仕様と設計に沿った実装不備、テスト不足、型、lint、表示崩れ、命名、局所的な挙動修正
- Ship / Learn: PR本文、検証結果、レビュー返信、thread resolve、残リスク、恒久ナレッジ化に関わるコメント

## 対応ルール

- Build / Verify に分類できるコメントだけ、その場で修正する。
- Requirements / PRD または Design / Plan に戻るコメントは、実装修正せず止めて報告する。
- Ship / Learn のコメントは、差分の事実、検証結果、返信内容、resolve可否が確認できる範囲で対応する。
- 複数工程にまたがるコメントは、最も上流の工程に分類する。
- 分類が曖昧な場合は、実装修正せず、何が未決かを明示する。

## 返信ルール

対応済みコメントへ返信するときは、次を簡潔に書きます。

- どの分類として扱ったか
- 何を変更したか、またはなぜ変更しなかったか
- 対応 commit がある場合は commit ID
- 検証した内容

AGENTS.md のルールに従い、PRコメント内の commit ID はバッククォートで囲みません。

## Stop条件

次に該当する場合は、Build / Verify として修正しません。

- PRDの受け入れ条件を変える必要がある
- Design Docの採用方針を変える必要がある
- DB / API / 認証 / 権限モデルの変更が新たに必要になる
- policyや恒久ドキュメントへ戻すべき横断ルールが含まれる
- review threadをresolveすると未解決の仕様判断を隠すおそれがある

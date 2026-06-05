---
title: Web Test Policy
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src
topics:
  - test
  - regression
when_to_read:
  - Webアプリのテストを追加または変更するとき
  - review対応でテストを追加するか判断するとき
---

# Web Test Policy

テストは、ユーザーに残る挙動の回帰を防ぐために追加します。

## 基本方針

- loading、error、正常表示、条件変更後の復帰など、ユーザーに見える永続的な挙動を対象にします。
- 実装順序、コンポーネント内部の一時的な並び、review 対応の途中状態だけを固定するテストは追加しません。
- 一時的な確認だけが目的のテストは、実装完了後に残しません。
- API 通信を伴うテストでは、実際のコンポーネント操作と API 境界を通して確認します。

## 関連ポリシー

- `apps/web/docs/policies/msw-handlers.md`
- `apps/web/docs/policies/suspense-boundaries.md`

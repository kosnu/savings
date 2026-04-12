---
title: MSW Handler Policy
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src/test/msw/handlers
topics:
  - msw
  - test
  - mock
when_to_read:
  - MSW handlerを追加または変更するとき
  - API通信を伴うテストを追加または変更するとき
  - テスト用レスポンスやリクエスト検証の責務を判断するとき
---

# MSW Handler Policy

MSW handler は、テスト対象が依存する API 境界を再現するために使います。

handler には、アプリの業務ロジックや DB の問い合わせロジックを重複実装しません。データの選択、並び替え、優先順位、集計などがテスト対象の仕様である場合は、アプリ側の関数や query のテストで確認します。

## 基本方針

- handler の default response は、代表的な正常系に絞ります。
- テストごとの差分は handler factory の option で明示します。
- 実 API の response shape は守ります。
- 将来使うかもしれない汎用性は先に入れません。
- 未使用の HTTP method handler や option は追加しません。
- error や delay は既存 handler と同じく option で制御します。
- handler factory は `server.resetHandlers(...createXHandlers())` で使える形にします。

## リクエスト条件の扱い

handler 内で request の filter、order、limit などを汎用的に解釈しません。

リクエスト条件そのものが重要な仕様である場合は、handler が条件を解釈して正しい結果を返すのではなく、テスト側で request を検査して期待する query が送られていることを確認します。

これにより、mock 側に本番と同じ選択ロジックが重複することを避けます。

## 状態を持つ mock

stateful な mock は、mutation の結果を同一テスト内の後続 request に反映する必要がある場合だけ使います。

単に成功・失敗・特定レスポンスを確認したいだけなら、固定 response を option で指定します。

## 追加タイミング

handler は、必要なテストができた時点で追加します。

作成、更新、削除などの mutation handler は、それらを使う feature やテストが存在しない段階では追加しません。

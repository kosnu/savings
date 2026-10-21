---
title: Query Performance Verification
doc_type: policy
status: accepted
area: api
applies_to:
  - apps/api/supabase/migrations
  - apps/api/supabase/tests
topics:
  - sql
  - query-performance
  - verification
when_to_read:
  - SQLやRPCの取得範囲、並べ替え、集約、JOIN、索引を変更するとき
  - 件数や期間の制限によるDB負荷対策を設計またはレビューするとき
---

# Query Performance Verification

SQL・RPCの負荷対策は、返却結果の正しさと、結果を返すまでの処理量を分けて検証します。
件数・期間の制限を負荷対策に使う場合は、その制限が効く前に必要となる処理も確認します。
認可と操作の完全性は[Transaction Boundaries](transaction-boundaries.md)と対象domainの規則に従います。

## 適用と確認条件

取得範囲、並べ替え、集約、JOIN、索引の変更では、影響するクエリと負荷への影響を特定します。
負荷制限を目的にする変更や、大量データでの処理量が変わる変更では、代表条件の実行計画を確認します。
クエリの処理量へ影響しない文言・表示だけの変更に、性能測定を要求しません。

- 返却件数、候補件数、走査・除外行数、並べ替えや集約の対象件数を区別する。
- `LIMIT`より前の並べ替え・集約・JOINと、条件・順序に対応する索引を確認する。`LIMIT`があることだけで処理量が制限されたと判断しない。
- 通常件数、上限付近、大幅超過に加え、同日への集中や条件に一致する行が少ない場合など、対象クエリに影響する分布を選ぶ。固定の件数を全クエリの基準にしない。
- 実際の呼出role、RLS、Book等の絞り込み、引数を維持する。認可を外した計画だけで実経路の性能を判断しない。
- 性能改善のために、必要な行の切り捨て、順序・型・認可の変更、同時変更時の欠落を許容しない。

## 実行計画と合格判断

隔離環境の合成データと統計情報を整え、変更前後を同じ条件で比較します。
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`などで、処理行数、除外行数、反復回数、ソートの対象・方式、読み取り量を確認します。
RPC全体の呼出計画だけで内部SQLが見えない場合は、検証対象と同じ定義・条件の内部SQLを確認します。
`EXPLAIN ANALYZE`は実行を伴うため、共有環境のデータを変更せず、隔離検証の後に自分の合成データを破棄します。

合格条件は目的に必要な性質から定めます。たとえば、件数超過を早期に拒否する目的なら、不要な制限前ソートがなく、後段のソート対象が候補上限以内に収まることを確認します。
候補数の制限を、RLS・filterを含む全走査量の上限と同一視しません。
同じ出力と完全性を保てることは、SQL・APIの回帰テストでも確認します。

実行計画全文、特定の索引名、固定の経過時間だけを合格条件にしません。
時間の比較はデータ量・分布・role・統計情報などの前提と併せて評価し、目標負荷や許容時間が未定なら本番性能を保証したと扱いません。
確認した条件、目的から導いた期待、観測結果、未確認の限界を既存のPR・検証要約へ残します。生の計画やコマンド出力を恒常文書・工程記録へ保存しません。

参照: [PostgreSQL: Indexes and ORDER BY](https://www.postgresql.org/docs/17/indexes-ordering.html)、[Using EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)。

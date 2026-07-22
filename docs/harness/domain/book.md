---
title: Book Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/api/supabase/migrations
  - apps/web/src/types/database.types.ts
topics:
  - domain
  - book
  - ownership
  - authorization
when_to_read:
  - Book所有モデル、default book、book member権限を確認するとき
---

# Book Domain Rules

## Rules

- Bookは支払い、カテゴリ、月次予算の所有境界になる。
- Book membershipはユーザーとBookの所属関係を表す。
- 同じユーザーは同じBookに重複所属できない。
- 認証ユーザーのdefault bookはBook membershipで判定する。
- 新規ユーザーにはdefault bookとmembershipを作成する。
- 認証ユーザーにはdefault bookが存在する前提で扱う。
- Book-owned dataの作成時に所有先Bookが未指定の場合、認証ユーザーのdefault bookを使う。
- Book-owned dataは、対象Bookのmemberだけが参照・作成・更新・削除できる。
- Book-owned dataの所有先Bookは更新時に維持される。
- 同じテーブルでBook ownership補完・維持triggerと、`new.book_id` に依存する検証triggerを併用する場合、検証triggerは補完・維持triggerより後に実行される名前にする。
- trigger実行順に依存する場合は、自然な動詞順に頼らず `trg_10_...`、`trg_20_...` のような番号付き命名で順序を固定する。

## 暫定監督ルール

### 複数Book管理を提供するまで

- Bookに関するすべてのタスクとレビューで、default bookをユーザーが操作できる唯一のBookとして扱う。
- DBやschemaが複数のBook membershipを許容することだけを理由に、複数Book対応を受け入れ条件へ追加したり、未対応をブロッキング指摘にしたりしない。
- タスクが複数Book管理または既存の複数Book membershipを明示的に対象とする場合は、この暫定ルールを根拠に対象外へ戻さない。
- ユーザーが複数のBookを作成または選択できる体験を導入した時点で、この暫定ルールは失効する。
- 失効時には、選択中のBookとBook-owned dataの対応、およびBook選択とmembershipによる認可の責務差を、体験のRequirementsと恒久ルールとして定義する。

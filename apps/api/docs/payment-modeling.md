# Payment Information Modeling (支払い情報のモデリング)

このドキュメントは、支払い情報（Payment）に関するドメインモデリングの詳細を図示・説明します。

## 概要

支払い情報システムは、ユーザーの支払い記録を管理するドメインモデルです。クリーンアーキテクチャの原則に従い、ビジネスルールを中心に設計されています。

アプリケーション層では ID を `number` として扱い、PostgreSQL 側は `bigint` のまま運用します。

## エンティティ関連図（Entity Relationship）

```
┌─────────────────────────────────────────────────────────────────┐
│                          Payment (支払い)                        │
├─────────────────────────────────────────────────────────────────┤
│ - id: PaymentId (number)                                        │
│ - note: Note (string | null)                                    │
│ - amount: Amount (number)  ※負の値を許容                        │
│ - date: PaymentDate (Date)                                      │
│ - createdAt: Date | null                                        │
│ - updatedAt: Date | null                                        │
│ - categoryId: CategoryId | null                                 │
│ - userId: UserId (number)                                       │
└─────────────────────────────────────────────────────────────────┘
              │                           │
              │ N                         │ N
              │                           │
              ▼ 0..1                      ▼ 1
┌──────────────────────┐      ┌──────────────────────┐
│  Category (カテゴリ) │      │    User (ユーザー)    │
├──────────────────────┤      ├──────────────────────┤
│ - id: bigint         │      │ - id: bigint         │
│ - name: string       │      │ - externalId: string │
│ - createdAt: Date    │      │ - name: string       │
│ - updatedAt: Date    │      │ - email: string      │
└──────────────────────┘      │ - createdAt: Date    │
                              │ - updatedAt: Date    │
                              └──────────────────────┘
```

### リレーションシップ

- **Payment → User**: 必須の多対一関係。各支払いは必ず1人のユーザーに紐づく（user_id not null）
- **Payment → Category**: 任意の多対一関係。支払いはカテゴリを持つことも持たないこともある（category_id null許容）
- カテゴリ削除時: `ON DELETE SET NULL` - 支払いレコードは残り、category_idがnullに設定される
- ユーザー削除時: `ON DELETE CASCADE` - ユーザーに紐づく全ての支払いが削除される

## Value Objects（値オブジェクト）詳細

### 1. PaymentId

```typescript
type PaymentId = {
  value: Readonly<number>
}
```

**目的**: 支払いの一意識別子
**制約**: 正の整数（safe integer, > 0）
**バリデーション**: 値が正であることを検証

### 2. Amount（金額）

```typescript
type Amount = {
  value: Readonly<number>
}
```

**目的**: 支払い金額の表現
**制約**:

- **整数値であること** (`Number.isInteger(value)`)
- **負の値を許容** - 返金や払い戻しなどマイナスの金額を表現可能

**ビジネスルール**:

- 正の値: 通常の支払い（例: 1000 = 1000円の支払い）
- 負の値: 返金・払い戻し（例: -500 = 500円の返金）
- ゼロ: 記録のみで金銭移動がない場合

**データベース**: `numeric(10, 2)` として保存されるが、アプリケーション層では整数として扱う

### 3. Note（メモ）

```typescript
type Note = {
  value: Readonly<string | null>
}
```

**目的**: 支払いに関する補足情報
**制約**:

- null許容（メモがない支払いも可能）
- 空文字列の場合はnullとして扱う
- 最大255文字（DBスキーマ制約）

### 4. PaymentDate（支払日）

```typescript
type PaymentDate = {
  value: Readonly<Date>
}
```

**目的**: 支払いが発生した日付
**制約**:

- 有効なDate型であること
- 必須項目（null不可）

### 5. CategoryId（カテゴリID）

```typescript
type CategoryId = {
  value: Readonly<number>
}
```

**目的**: 支払いのカテゴリ分類
**制約**:

- 正の整数（safe integer, > 0）
- Payment内ではnull許容（カテゴリなしの支払いが可能）

### 6. UserId（ユーザーID）

```typescript
type UserId = {
  value: Readonly<number>
}
```

**目的**: 支払いを行ったユーザーの識別
**制約**:

- 正の整数（safe integer, > 0）
- 必須項目（すべての支払いはユーザーに紐づく）

## ドメインルール（Business Rules）

### 1. Amount（金額）に関するルール

#### ✅ 許可される値

```typescript
// 正の値 - 通常の支払い
createAmount(1000) // OK: 1000円の支払い
createAmount(50000) // OK: 50000円の支払い

// ゼロ - 金銭移動のない記録
createAmount(0) // OK: 記録のみ

// 負の値 - 返金・払い戻し
createAmount(-500) // OK: 500円の返金
createAmount(-1000) // OK: 1000円の払い戻し
```

#### ❌ 許可されない値

```typescript
// 小数値
createAmount(100.5) // NG: 整数でない
createAmount(99.99) // NG: 整数でない

// 非数値
createAmount(NaN) // NG: 数値でない
createAmount(Infinity) // NG: 有限値でない
```

### 2. Note（メモ）に関するルール

```typescript
// 空文字列はnullとして扱う
createNote("") // OK: null as value
createNote(null) // OK: null as value
createNote("夕食代") // OK: "夕食代"
```

### 3. CategoryId（カテゴリ）に関するルール

- 支払い作成時にカテゴリは任意
- カテゴリが削除された場合、支払いのcategoryIdはnullに設定される（支払いデータは保持）
- 存在しないカテゴリIDは設定できない（外部キー制約）

### 4. UserId（ユーザー）に関するルール

- すべての支払いは必ずユーザーに紐づく（必須）
- ユーザーが削除された場合、そのユーザーの全支払いも削除される（CASCADE）

## ユースケース例

### 通常の支払い記録

```typescript
createPayment({
  id: 1,
  note: "スーパーで食料品",
  amount: 5000, // 5000円の支払い
  date: new Date("2026-01-30"),
  categoryId: 10, // 食費カテゴリ
  userId: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

### 返金の記録

```typescript
createPayment({
  id: 2,
  note: "不良品返品による返金",
  amount: -3000, // 3000円の返金（負の値）
  date: new Date("2026-01-30"),
  categoryId: null, // カテゴリなし
  userId: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

### メモなしの記録

```typescript
createPayment({
  id: 3,
  note: null, // メモなし
  amount: 1000,
  date: new Date("2026-01-30"),
  categoryId: 5,
  userId: 100,
  createdAt: null,
  updatedAt: null,
})
```

## データフロー図

```
┌──────────────┐
│   Client     │
└──────┬───────┘
       │ HTTP Request
       │ (JSON)
       ▼
┌──────────────────────────────────┐
│  Interfaces Layer                │
│  - HTTP Handler                  │
│  - Request Validation            │
│  - Response Formatting           │
└──────┬───────────────────────────┘
       │ DTO
       ▼
┌──────────────────────────────────┐
│  Application Layer               │
│  - Use Cases                     │
│  - Business Flow                 │
└──────┬───────────────────────────┘
       │ Domain Objects
       ▼
┌──────────────────────────────────┐
│  Domain Layer                    │
│  ┌────────────────────────────┐ │
│  │ Payment Entity             │ │
│  │ - id: PaymentId            │ │
│  │ - amount: Amount ※負の値OK │ │
│  │ - note: Note               │ │
│  │ - date: PaymentDate        │ │
│  │ - categoryId: CategoryId   │ │
│  │ - userId: UserId           │ │
│  └────────────────────────────┘ │
│                                  │
│  Value Objects:                  │
│  Amount, Note, PaymentDate, etc. │
└──────┬───────────────────────────┘
       │ Repository Interface
       ▼
┌──────────────────────────────────┐
│  Infrastructure Layer            │
│  - PaymentRepositoryImpl         │
│  - Supabase Client               │
└──────┬───────────────────────────┘
       │ SQL Query
       ▼
┌──────────────────────────────────┐
│  Database (PostgreSQL)           │
│  - payments table                │
│  - amount: numeric(10,2)         │
└──────────────────────────────────┘
```

## 実装ファイル構成

```
apps/api/supabase/functions/payments/
├── index.ts                     # エントリーポイント
├── deno.json                    # Deno 設定
└── src/
    ├── domain/
    │   ├── entities/
    │   │   ├── payment.ts           # Payment Entity定義
    │   │   └── payment.test.ts      # Paymentのテスト
    │   ├── valueObjects/
    │   │   ├── amount.ts            # Amount値オブジェクト ※負の値許容
    │   │   ├── amount.test.ts       # Amountのテスト
    │   │   ├── categoryId.ts        # CategoryId値オブジェクト
    │   │   ├── categoryId.test.ts
    │   │   ├── note.ts              # Note値オブジェクト
    │   │   ├── note.test.ts
    │   │   ├── paymentDate.ts       # PaymentDate値オブジェクト
    │   │   ├── paymentDate.test.ts
    │   │   ├── paymentId.ts         # PaymentId値オブジェクト
    │   │   ├── paymentId.test.ts
    │   │   ├── userId.ts            # UserId値オブジェクト
    │   │   └── userId.test.ts
    │   └── repository.ts            # PaymentRepositoryインターフェース
    ├── application/
    │   └── searchPaymentsUseCase.ts # ユースケース実装
    ├── infrastructure/
    │   ├── paymentRepositoryImpl.ts  # Repository実装
    │   └── utils/
    │       ├── mapRowToPayment.ts    # DB行からエンティティへのマッピング
    │       └── getUserIdByExternalId.ts
    ├── interfaces/
    │   ├── server.ts                # Hono サーバー初期化
    │   ├── routes/                  # ルーティング定義
    │   └── handlers/                # HTTP ハンドラ
    │       ├── paymentsController.ts
    │       ├── paymentDto.ts
    │       ├── validateCriteria.ts
    │       └── errorResponse.ts
    ├── shared/
    │   ├── types.ts                 # Supabase 型定義
    │   ├── errors.ts                # ドメインエラー定義
    │   ├── result.ts                # Result型定義
    │   └── unwrapOk.ts
    ├── generated/                   # 自動生成ファイル（型定義等）
    └── test/                        # テストユーティリティ
```

## データベーススキーマ

```sql
create table payments (
    id bigint generated always as identity primary key,
    note varchar(255),
    amount numeric(10, 2) not null,  -- 負の値も保存可能
    date date not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    category_id bigint null references categories(id) on delete set null,
    user_id bigint not null references users(id) on delete cascade
);

create index idx_payments_user_date_category_created
    on payments (user_id, date, category_id, created_at);
```

### スキーマ設計のポイント

1. **amount は numeric(10, 2)**
   - 整数から小数までの柔軟な保存が可能
   - アプリケーション層では整数として扱う
   - 負の値も保存可能（制約なし）

2. **category_id は nullable**
   - カテゴリ未分類の支払いを許容
   - カテゴリ削除時は `SET NULL` で支払いデータを保持

3. **user_id は not null**
   - すべての支払いは必ずユーザーに紐づく
   - ユーザー削除時は `CASCADE` で関連支払いも削除

4. **複合インデックス**
   - 検索パフォーマンス最適化（ユーザー別・日付範囲・カテゴリ別）

## まとめ

### 重要なポイント

1. **Amount（金額）は負の値を許容**
   - 返金・払い戻しなどのユースケースに対応
   - 整数値のみを許可（小数は不可）

2. **値オブジェクトによる型安全性**
   - プリミティブ型の代わりに意味を持つ型を使用
   - バリデーションロジックをカプセル化

3. **クリーンアーキテクチャの実装**
   - ドメインロジックは外部依存から分離
   - インターフェースを通じた疎結合

4. **柔軟なデータモデル**
   - カテゴリは任意（null許容）
   - メモも任意（null許容）
   - 各支払いは必ずユーザーに紐づく

この設計により、支払い情報を柔軟かつ型安全に管理できます。

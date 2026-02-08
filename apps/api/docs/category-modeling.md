# Category Information Modeling (カテゴリ情報のモデリング)

このドキュメントは、カテゴリ情報（Category）に関するドメインモデリングの詳細を図示・説明します。

## 概要

カテゴリ情報システムは、支払い情報を分類するためのマスターデータを管理するドメインモデルです。クリーンアーキテクチャの原則に従い、ビジネスルールを中心に設計されています。

## エンティティ関連図（Entity Relationship）

```
┌──────────────────────────┐
│  Category (カテゴリ)     │
├──────────────────────────┤
│ - id: CategoryId (bigint)│
│ - name: CategoryName     │
│ - createdAt: Date        │
│ - updatedAt: Date        │
└──────────────────────────┘
        ▲
        │ 0..1
        │ N
┌─────────────────────────────────────┐
│      Payment (支払い)                │
├─────────────────────────────────────┤
│ - categoryId: CategoryId | null     │
│ ...                                 │
└─────────────────────────────────────┘
```

### リレーションシップ

- **Payment → Category**: 任意の多対一関係
  - 各支払いは 0 または 1 つのカテゴリに紐づく
  - カテゴリが削除された場合、支払いの `categoryId` は null に設定される（`ON DELETE SET NULL`）

## Value Objects（値オブジェクト）詳細

### 1. CategoryId

```typescript
type CategoryId = {
  value: Readonly<bigint>
}
```

**目的**: カテゴリの一意識別子  
**制約**: 正の整数（bigint > 0）  
**バリデーション**: 値が正であることを検証

### 2. CategoryName（カテゴリ名）

```typescript
type CategoryName = {
  value: Readonly<string>
}
```

**目的**: カテゴリの表示名  
**制約**: 
- 空でない文字列（トリム後）
- 前後の空白は自動的にトリムされる

**ビジネスルール**:
- 空文字列は許可されない
- 前後の空白は自動的に削除される

## ドメインルール（Business Rules）

### 1. CategoryName（名前）に関するルール

#### ✅ 許可される値
```typescript
createCategoryName("食費")        // OK: "食費"
createCategoryName("  交通費  ")  // OK: "交通費" (自動トリム)
createCategoryName("Entertainment") // OK: "Entertainment"
```

#### ❌ 許可されない値
```typescript
createCategoryName("")            // NG: 空文字列
createCategoryName("   ")         // NG: 空白のみ（トリム後空文字列）
```

### 2. カテゴリの一意性

- カテゴリ名はシステム内で一意であることが推奨される（ただし、DB制約ではない）
- ユーザーが同じ名前のカテゴリを複数作成できる場合は、UI/アプリケーション層で適切に処理する

## ユースケース例

### カテゴリの作成
```typescript
createCategory({
  id: createCategoryId(1n).unwrap(),
  name: createCategoryName("食費").unwrap(),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
})
```

### カテゴリの一覧取得
```typescript
// getAllCategoriesUseCase を通じて全カテゴリを取得
const result = await getAllCategoriesUseCase.execute()
if (result.isOk()) {
  const categories = result.value
  // カテゴリ一覧を使用
}
```

## データフロー図

```
┌──────────────┐
│   Client     │
└──────┬───────┘
       │ HTTP Request
       │ (GET /categories)
       ▼
┌──────────────────────────────────┐
│  Interfaces Layer                │
│  - HTTP Handler (Hono)           │
│  - Request Validation            │
│  - Response Formatting           │
└──────┬───────────────────────────┘
       │ 
       ▼
┌──────────────────────────────────┐
│  Application Layer               │
│  - getAllCategoriesUseCase       │
└──────┬───────────────────────────┘
       │ 
       ▼
┌──────────────────────────────────┐
│  Domain Layer                    │
│  ┌────────────────────────────┐ │
│  │ Category Entity            │ │
│  │ - id: CategoryId           │ │
│  │ - name: CategoryName       │ │
│  │ - createdAt: Date          │ │
│  │ - updatedAt: Date          │ │
│  └────────────────────────────┘ │
│                                  │
│  Value Objects:                  │
│  CategoryId, CategoryName        │
└──────┬───────────────────────────┘
       │ Repository Interface
       ▼
┌──────────────────────────────────┐
│  Infrastructure Layer            │
│  - CategoryRepositoryImpl        │
│  - Supabase Client               │
└──────┬───────────────────────────┘
       │ SQL Query
       ▼
┌──────────────────────────────────┐
│  Database (PostgreSQL)           │
│  - categories table              │
└──────────────────────────────────┘
```

## 実装ファイル構成

```
apps/api/supabase/functions/categories/
├── index.ts                     # エントリーポイント
├── deno.json                    # Deno 設定
└── src/
    ├── domain/
    │   ├── entities/
    │   │   ├── category.ts          # Category Entity定義
    │   │   └── category.test.ts     # Categoryのテスト
    │   ├── valueObjects/
    │   │   ├── categoryId.ts        # CategoryId値オブジェクト
    │   │   ├── categoryId.test.ts
    │   │   ├── categoryName.ts      # CategoryName値オブジェクト
    │   │   └── categoryName.test.ts
    │   └── repository.ts            # CategoryRepositoryインターフェース
    ├── application/
    │   ├── categoryDto.ts           # DTO定義
    │   ├── categoryDto.test.ts
    │   ├── getAllCategoriesUseCase.ts # ユースケース実装
    │   └── getAllCategoriesUseCase.test.ts
    ├── infrastructure/
    │   ├── categoryRepositoryImpl.ts  # Repository実装
    │   └── utils/
    │       └── mapRowToCategory.ts    # DB行からエンティティへのマッピング
    ├── interfaces/
    │   ├── server.ts                # Hono サーバー初期化
    │   ├── routes/                  # ルーティング定義
    │   └── handlers/                # HTTP ハンドラ
    │       ├── categoriesController.ts
    │       └── errorResponse.ts
    ├── shared/
    │   ├── types.ts                 # Supabase 型定義
    │   ├── errors.ts                # ドメインエラー定義
    │   ├── result.ts                # Result型定義
    │   └── supabase/                # Supabase ユーティリティ
    └── test/                        # テストユーティリティ
```

## データベーススキーマ

```sql
create table categories (
    id bigint generated always as identity primary key,
    name varchar(255) not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);
```

### スキーマ設計のポイント

1. **id は自動生成**
   - `bigint generated always as identity` により自動インクリメント
   - 正の整数のみが生成される

2. **name は not null**
   - カテゴリ名は必須
   - アプリケーション層でも空文字列を拒否

3. **タイムスタンプ**
   - `created_at` と `updated_at` で作成・更新日時を管理
   - デフォルト値により自動設定

## まとめ

### 重要なポイント

1. **シンプルなドメインモデル**
   - カテゴリはIDと名前のみのシンプルな構造
   - ビジネスルールは主に名前の検証に集中

2. **値オブジェクトによる型安全性**
   - CategoryId と CategoryName で意味を持つ型を使用
   - バリデーションロジックをカプセル化

3. **クリーンアーキテクチャの実装**
   - ドメインロジックは外部依存から分離
   - インターフェースを通じた疎結合

4. **支払い情報との関係**
   - 支払いは任意でカテゴリに紐づく
   - カテゴリ削除時も支払いデータは保持される（`SET NULL`）

この設計により、カテゴリ情報を型安全かつシンプルに管理できます。

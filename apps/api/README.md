# Savings API

Supabase の設定・DB マイグレーション管理を行うディレクトリです。

## セットアップ

この README 内のコマンドは、特記がない限り `apps/api/` ディレクトリで実行します。

### 前提条件

- **pnpm**: 依存関係のインストールに使用
  - インストール: リポジトリルートで `pnpm install`
- **Supabase CLI**: ローカル開発環境の管理に使用。依存関係のバージョンはリポジトリルートの `package.json` で管理します。

### ローカル Supabase の起動

```bash
# Supabase 起動
pnpm start

# 停止
pnpm stop
```

## データベース

### マイグレーション

データベーススキーマは `supabase/migrations/` ディレクトリで SQL マイグレーションファイルとして管理されています。

```bash
# マイグレーション適用
pnpm migrations:up

# マイグレーション作成
pnpm exec supabase migration new <migration_name>
```

### シード

初期データは `supabase/seed/` ディレクトリにあります。

```bash
# シードデータ投入（例）
bin/init_seed supabase/seed/categories.sql
```

## ディレクトリ構成

```
apps/api/
├── supabase/
│   ├── config.toml              # Supabase の設定
│   ├── migrations/              # データベースマイグレーション
│   └── seed/                    # 初期データ
├── bin/                         # 補助スクリプト
└── package.json                 # API 用 scripts
```

## 月予算writeの現在月

月予算の作成・更新・削除／無効化は、DBが受け取ったSQL statementの開始時刻
(`statement_timestamp()`) を `Asia/Tokyo` に変換した年・月で判定します。
日本時間の毎月1日0時で切り替わり、年替わりも同じです。statement開始後に
月を跨いでも、その操作内の認可月と反映月は固定します。長いtransaction内でも
次のstatementは新しい開始時刻を使います。DB sessionのtimezone設定には依存しません。

- 作成は、入力されたdate-only対象月を月初に正規化し、日本時間の現在月以降だけ許可します。
- 更新・無効化はIDで指定したレコードが日本時間の現在月に有効な金額あり予算の場合だけ許可します。
  当月開始なら同じ行を変更し、過去月開始なら過去行を保持して当月開始の行を追加します。
  未来月開始、現在有効でない行、予算なし状態への操作は拒否します。
- 月末日は認可月の月初に1か月を足して1日を引いたdateです。
  date-onlyは時刻ではなく、Webでのローカル日付解釈とDBのdate値を維持します。

表示対象月はWebが所有するreadの対象です。ブラウザのローカル月、ユーザーが
選択した月、開いたままの画面と認可月のずれを許容します。例えば日本時間の
2027年1月1日0時はUTCでは2026年12月31日15時ですが、writeは1月として判定します。
表示中のIDが1月にも有効なら更新・無効化は1月に反映され、12月の表示は変わりません。
表示IDが現在有効でなければRPCが拒否し、既存の操作エラーを表示します。
表示される編集ボタン自体は実行許可を保証しません。

Webの作成フォームは端末時刻で過去月を拒否せず、DBの判定結果を既存の月制約エラーで
表示します。クライアントの時計・timezone・表示月は認可入力ではありません。
更新・無効化のRPCへ現在月や対象月を渡すこともありません。

既存の月予算状態・Book認可・RPC署名と権限は維持します。API先行配備中も旧Webから
同じRPCを呼び出せますが、旧Webの作成フォームには端末時刻による制限が残るため、
時差による誤拒否の解消はWeb更新後です。過去データの書き換えは行いません。

### 月境界の検証

`supabase/tests/monthly_budget_timezone.test.sql` はpgTAPで、日本時間の通常月・年替わり・
うるう年の境界前後をUTC、日本、米国のsession timezoneで検証します。
テストtransaction内だけ実際のRPC定義の時刻取得を固定値へ置換し、月換算・認可・
状態遷移の本体を実行します。本番の時刻入力口は追加しません。最後にrollbackします。
既存の `monthly_budget_write_boundary.test.sql` も実行してID・Book・直接table操作の境界を確認します。

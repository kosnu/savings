# Supabase verifier

確認対象と合格条件の正本は[Dev確認手順](../../docs/supabase-dev-verification.md)。
検証ロジックはこのGo moduleに置き、workflowには起動コマンドだけを置く。

## 実行

repository rootで、GoとDockerとSupabase CLI（workflowと同じ固定版）を用意する。

```sh
go -C tools/supabase-check test ./...
go -C tools/supabase-check vet ./...
go -C tools/supabase-check run . local --root "$PWD"
go -C tools/supabase-check run . assets --root "$PWD"
```

`local`は専用の一時構成で起動し、repositoryのmigrationと既存pgTAPを適用・実行する。
既存のローカル・Dev DBをresetしない。同名の検証containerが存在する場合は停止せず失敗する。
終了時に自分のcontainer・volume・一時ファイルだけを破棄する。
API試験の対象一覧とDB catalogを照合し、未対応の公開対象が増えたら失敗する。

`assets`はビルド済みのブラウザ配信ディレクトリを検査する。`--dir`で変更可能。
実配信物は`dev`で、対象PR headの配信成功statusから解決したDev Previewを検査する。

## Dev照合

`Supabase verification`の手動実行にPR番号と完全なhead SHAを指定する。mainだけで実行し、development Environmentの承認を使う。
DevのDB・Auth・設定は読み取りのみ。DB更新と同じconcurrency groupで照合中の競合を避ける。
mainにworkflowが入るまでは、この経路は実行できない。

必要な入力は次のとおり。既存tokenの権限を自動拡張・発行しない。

- development Secrets: `SUPABASE_PROJECT_ID`、`SUPABASE_ACCESS_TOKEN`、`VITE_SUPABASE_PUBLISHABLE_KEY`
- development Variables: `SUPABASE_DEV_EXPECTATIONS`
- workflowが渡すread専用`GH_TOKEN`、`PR_NUMBER`、`EXPECTED_HEAD`

PATはDev project限定とし、Auth、Data API、SSL、Network Restrictions、Storage、Realtime、
Functions、poolerの各読み取りと、read-only SQL APIの権限が必要。
既存のDB適用用PATだけでは不足する可能性がある。権限と有効期限は所有者が確認する。

期待値はJSONで`settings`に`auth`、`postgrest`、`ssl`、`network`、`storage`、`realtime`、`functions`、`pooler`を指定する。
各値はManagement API応答の検査対象部分。objectは指定fieldを比較し、array・scalarは完全一致。
空object、必須項目の欠落、取得失敗、値の不一致は失敗とする。
検査するendpointとAuthの必須fieldは[dev.go](dev.go)が所有し、このREADMEには複製しない。
期待値の採用判断・登録は所有者が行い、未登録の実行は失敗する。

Dev DBの比較元は承認したPR headのSQLだけを取得して起動した隔離DB。履歴・RLS・index・関数定義・実効権限を比較する。
Devの読み取りAPIの利用可否と必要権限は実行時に検証する。未取得を一致として扱わない。

## 検証範囲

- 既存pgTAPによるDB境界・月次予算の履歴／期間境界
- 実Auth/Data APIによる本人・別利用者・未認証のテーブル境界、保護列、RPC、session更新、通常操作
- API上限を超えるデータの分割取得とDB集計
- Dev実設定と期待値、migrationから構築したDBとDev DBの照合
- ビルド済み配信物、Dev配信物の秘密情報混入検査

Google OAuthの実機確認、所有者の期待値・例外・運用判断は自動判定しない。
APIの分割取得試験はWebアプリの表示試験ではなく、ブラウザの自動session更新・一覧の上限超過表示まで成功を保証しない。
これらは既存Webテストの確認範囲と分け、追加試験がない範囲は未確認とする。

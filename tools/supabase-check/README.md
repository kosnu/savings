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

`local`の隔離環境は、CI実行中だけDockerで起動する専用Supabase。
候補configをTOMLとして読み、既存の認証・環境変数参照・無効サービスの契約を検査してから、
隔離用の固定構成でrepositoryのmigrationと既存pgTAPを適用・実行する。Hostedの環境変数は展開しない。
既存のローカル・Dev DBをresetしない。同名の検証containerが存在する場合は停止せず失敗する。
終了時に自分のcontainer・volume・一時ファイルだけを破棄する。
API試験の対象一覧とDB catalogを照合し、未対応の公開対象が増えたら失敗する。

`assets`はビルド済みのブラウザ配信ディレクトリを検査する。`--dir`で変更可能。
実配信物は`dev`で、対象PR headの配信成功statusから解決したDev Previewを検査する。

## Dev照合

`Supabase verification`の手動実行にPR番号と完全なhead SHAを指定する。mainだけで実行し、development Environmentを使う。人手のEnvironment承認待ちはない。
DevのDB・Auth・設定は読み取りのみ。DB更新と同じconcurrency groupで照合中の競合を避ける。
mainにworkflowが入るまでは、この経路は実行できない。

必要な入力は次のとおり。既存tokenの権限を自動拡張・発行しない。

- development Secrets: `SUPABASE_PROJECT_ID`、`SUPABASE_ACCESS_TOKEN`、`VITE_SUPABASE_PUBLISHABLE_KEY`
- development Variables: `SUPABASE_DEV_EXPECTATIONS`
- workflowが渡すread専用`GH_TOKEN`、`PR_NUMBER`、`EXPECTED_HEAD`

PATはDev project限定とし、Auth・Data APIとread-only SQL APIの読み取り権限が必要。
追加の設定照合を選んだ場合だけ、その項目の読み取り権限を使う。
既存のDB適用用PATだけでは不足する可能性がある。権限と有効期限は所有者が確認する。

期待値はJSONの`settings`に指定する。必須なのは`auth`と`postgrest`だけで、
Google認証の有効状態・Devの遷移先・`public`を含む公開schemaを照合する。
具体的な入力fieldは[dev.go](dev.go)が所有する。値は[Devプレビュー運用](../../docs/development-preview.md#devプロジェクトと認証)の採用方針に従う。
セッション期限・同時ログイン制限・更新猶予・CAPTCHA・rate limit・取得上限や、全サービスの具体値は必須入力にしない。

追加の設定は、採用済み期待値がある場合にだけ指定する。未指定の設定APIは呼ばず、照合済みとは扱わない。
設定項目とendpointは[dev.go](dev.go)が所有する。
objectは指定fieldを比較し、array・scalarは完全一致。
指定した期待値の空object、不正値、必須項目の欠落、取得失敗、不一致は失敗とする。
人が確認するセッション・不正利用対策・公開管理範囲の採用判断は[Dev確認手順](../../docs/supabase-dev-verification.md#人が確認決定する内容)に残す。

Dev DBの比較元は指定したPR headのSQLとconfigをデータとして取得し、configの契約検査後にSQLから起動した隔離DB。
履歴・RLS・index・関数定義・実効権限を比較する。候補のGo・JavaScriptは取得・実行しない。
Devの読み取りAPIの利用可否と必要権限は実行時に検証する。未取得を一致として扱わない。

## 検証範囲

- 既存pgTAPによるDB境界・月次予算の履歴／期間境界
- 実Auth/Data APIによる本人・別利用者・未認証のテーブル境界、保護列、RPC、session更新、通常操作
- API上限を超えるデータの分割取得とDB集計
- Dev実設定と期待値、migrationから構築したDBとDev DBの照合
- ビルド済み配信物、Dev配信物の秘密情報混入検査

Google OAuthの実機確認、所有者の期待値・例外・運用判断は自動判定しない。
ブラウザの自動session更新は人が確認する。APIのsession更新試験とは区別する。
既存のAPI上限試験はWebアプリの表示を検証するものではなく、取得上限超過時の一覧・集計確認は完了条件に含めない。

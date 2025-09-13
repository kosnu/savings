# データ入れ込みスクリプト

## 概要

このスクリプトは、指定されたCSVファイルからデータを読み込み、データベースに挿入するためのものです。
データベースの接続情報は環境変数から取得されます。

## 環境変数

サンプルから `.env` ファイルを生成する。

```shell
cp .env.sample .env
```

その後、自身のプロジェクトやサービスアカウントの鍵ファイルを用意し、適切な変数に代入する。

## 実行

```shell
task insert -- --file path/to/example.csv --collection {collection_name}
```

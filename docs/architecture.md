# Architecture Overview

このリポジトリはモノリポジトリ形式で、フロントエンド、バックエンド、インフラ、運用用スクリプトを分離して管理しています。ここでは高レベルなディレクトリ構成と各領域の役割を簡潔に説明します。詳細な操作手順や実装の細かい説明は各サブプロジェクトの README を参照してください。

## ルート構成（要旨）

- apps/ — アプリケーション群
  - apps/web/ — React + TypeScript + Vite フロントエンド（UI、Storybook、Vitest 等）
    詳細: [apps/web/README.md](../apps/web/README.md)
  - apps/api/ — Supabase (DB migrations, Auth config)
    詳細: [apps/api/README.md](../apps/api/README.md)
- infra/ — インフラ定義（Terraform モジュール、環境ごとの設定）
  詳細: [infra/README.md](../infra/README.md)
- docker/ — Docker 用イメージと設定（現在未使用）
- docs/ — リポジトリ全体のドキュメント（このファイルを含む）
- その他: CI ワークフロー、タスクランナー、環境設定ファイル（.env 等）

## 開発フローのポイント（短く）

- フロントエンドの依存は必ず `apps/web/` で管理し、インストールは `npm ci` を使うこと（README に従う）。参照: [apps/web/README.md](../apps/web/README.md)
- ローカルで Supabase（Auth / DB）を使う場合はリポジトリルートで `task api:up` を実行してから Web アプリを起動する。

## ドキュメントの参照先

- フロントエンド（開発・テスト・Storybook）: [apps/web/README.md](../apps/web/README.md)
- インフラ（Terraform、環境ごとの State 管理）: [infra/README.md](../infra/README.md)

- リポジトリ全体のトップ説明: [README.md](../README.md)

必要に応じて各 README の「セットアップ」や「テスト」セクションを参照してください。運用上の注意（シークレット管理、CI 設定、エミュレータ要件等）は各アプリケーションの README にまとめています。

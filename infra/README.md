# Terraform によるインフラ管理方針

## ディレクトリ構成（ベストプラクティス準拠）

```
infra/
  terraform/
    environments/
      production/   # 本番環境用root module
    modules/        # 共通module群
```

- `environments/production/` : 本番環境のリソースを管理する root module。
- `modules/` : 複数環境で使い回す module を配置。

## 管理方針

- それ以外のリソース（例: サーバー、ストレージ、ネットワーク等）は Terraform で新規作成。
- 各環境ごとに `environments/{env}` ディレクトリを作成し、環境ごとに State を分離。

### 例: 既存リソース参照

```hcl
# 例: 既存のFirebaseプロジェクト参照
data "google_project" "firebase" {
  project_id = "your-firebase-project-id"
}

# 例: 既存のCloudflareゾーン参照
data "cloudflare_zone" "main" {
  name = "your-domain.com"
}
```

### 例: 新規リソース作成

```hcl
resource "google_storage_bucket" "app_bucket" {
  name     = "your-app-bucket"
  location = "ASIA-NORTHEAST1"
}
```

## 運用

- `terraform init`/`plan`/`apply`は各環境ディレクトリで実行。
- module 追加時は `modules/` 配下に作成し、root module から呼び出す。

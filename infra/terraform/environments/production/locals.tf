locals {
  # 現在のディレクトリ名から環境名を動的に取得 (例: "production")
  environment = basename(path.cwd)

  # GCPプロジェクト情報
  gcp_project_id   = "savings-10897"
  gcp_project_name = "savings"
  gcp_region       = "asia-northeast1"

  # アプリケーションのドメイン名
  app_domain = "savings.kosnu.dev"
}

provider "google" {
  project = local.gcp_project_id
  region  = local.gcp_region
}

module "hosting" {
  source = "../../modules/hosting"

  gcp_project_id           = local.gcp_project_id
  firebase_hosting_site_id = local.gcp_project_id # 一意にするためにプロジェクトIDと同じにする
  app_domain               = local.app_domain
}

module "db" {
  source = "../../modules/db"

  gcp_project_id    = local.gcp_project_id
  db_name           = "${local.gcp_project_name}-${local.environment}"
  delete_protection = "DELETE_PROTECTION_DISABLED" # TODO: あとで無効化する
}

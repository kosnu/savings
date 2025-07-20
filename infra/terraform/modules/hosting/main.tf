# Firebase Hosting サイト作成
resource "google_firebase_hosting_site" "main" {
  provider = google-beta
  project  = var.gcp_project_id
  site_id  = var.firebase_hosting_site_id
}

# Firebase Hosting のカスタムドメイン設定
# ドメイン側でのDNSレコード設定は手動で行う
resource "google_firebase_hosting_custom_domain" "main" {
  provider   = google-beta
  depends_on = [google_firebase_hosting_site.main]

  project         = var.gcp_project_id
  site_id         = google_firebase_hosting_site.main.site_id
  custom_domain   = var.app_domain
  cert_preference = "PROJECT_GROUPED"

  wait_dns_verification = false
}
# Firebase Hosting のデフォルトチャネル
# TODO: チャンネルの運用方法を確立してから実装する

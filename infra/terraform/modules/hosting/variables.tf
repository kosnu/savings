variable "gcp_project_id" {
  description = "Firebase(Google Cloud)のプロジェクトID (既存)"
  type        = string
}

variable "firebase_hosting_site_id" {
  description = "Firebase HostingのSite ID (既存または新規)"
  type        = string
}

variable "app_domain" {
  description = "アプリケーションのドメイン名"
  type        = string
}

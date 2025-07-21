variable "gcp_project_id" {
  description = "Firebase(Google Cloud)のプロジェクトID (既存)"
  type        = string
}

variable "gcp_region" {
  description = "GCPリソースのデフォルトリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "db_name" {
  description = "Firestoreデータベース名"
  type        = string
}

variable "delete_protection" {
  description = "Firestoreデータベースの削除保護を有効にするか無効にするか"
  type        = string
  default     = "DELETE_PROTECTION_STATE_UNSPECIFIED"

  validation {
    condition     = contains(["DELETE_PROTECTION_STATE_UNSPECIFIED", "DELETE_PROTECTION_DISABLED", "DELETE_PROTECTION_ENABLED"], var.delete_protection)
    error_message = "The delete_protection must be one of 'DELETE_PROTECTION_STATE_UNSPECIFIED', 'DELETE_PROTECTION_DISABLED', or 'DELETE_PROTECTION_ENABLED'."
  }
}

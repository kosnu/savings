resource "google_firestore_database" "database" {
  project                           = var.gcp_project_id
  name                              = var.db_name
  location_id                       = var.gcp_region
  type                              = "FIRESTORE_NATIVE"
  concurrency_mode                  = "OPTIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  delete_protection_state           = var.delete_protection
}

# NOTE: ドキュメントやフィールド、インデックスなどはアプリケーション側の責務なのでここでは定義しない

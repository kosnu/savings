import type { Timestamp } from "firebase-admin/firestore"

/** Firestore `users/{userId}/payments` ドキュメントの型 */
export interface PaymentDocument {
  category_id: string
  note: string
  amount: number
  date: Timestamp
  user_id: string
  created_date: Timestamp
  updated_date: Timestamp
}

/** Supabase payments テーブルへのインサート型 */
export interface PaymentInsert {
  note: string | null
  amount: number
  date: string // YYYY-MM-DD
  category_id: number | null
  user_id: number
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

/** カテゴリマッピング: Firestore doc_id → Supabase db_id */
export type CategoryMapping = Map<string, number>

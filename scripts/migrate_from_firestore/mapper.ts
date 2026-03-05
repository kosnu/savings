import type {
  CategoryMapping,
  PaymentDocument,
  PaymentInsert,
} from "./types.ts"

/**
 * Firestoreの支払いデータをSupabaseのインサート形式に変換する
 */
export function mapPayment(
  doc: PaymentDocument,
  categoryMapping: CategoryMapping,
): PaymentInsert {
  const categoryId = doc.category_id
    ? (categoryMapping.get(doc.category_id) ?? null)
    : null
  if (doc.category_id && categoryId === null) {
    console.warn(
      `  警告: カテゴリID "${doc.category_id}" のマッピングが見つかりません`,
    )
  }

  const createdAt = (doc.created_date ?? doc.created_at)?.toDate().toISOString()
  const updatedAt = (doc.updated_date ?? doc.updated_at)?.toDate().toISOString()
  const now = new Date().toISOString()

  return {
    note: doc.note && doc.note !== "" ? doc.note : null,
    amount: doc.amount,
    date: formatDate(doc.date.toDate()),
    category_id: categoryId,
    user_id: 1,
    created_at: createdAt ?? now,
    updated_at: updatedAt ?? now,
  }
}

/** Date → "YYYY-MM-DD" (JST固定) */
function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d)
}

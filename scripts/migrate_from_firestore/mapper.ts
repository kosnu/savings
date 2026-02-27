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
  const categoryId = categoryMapping.get(doc.category_id) ?? null
  if (doc.category_id && categoryId === null) {
    console.warn(
      `警告: カテゴリID "${doc.category_id}" のマッピングが見つかりません`,
    )
  }

  return {
    note: doc.note && doc.note !== "" ? doc.note : null,
    amount: doc.amount,
    date: formatDate(doc.date.toDate()),
    category_id: categoryId,
    user_id: 1,
    created_at: doc.created_date.toDate().toISOString(),
    updated_at: doc.updated_date.toDate().toISOString(),
  }
}

/** Date → "YYYY-MM-DD" (UTCベース) */
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

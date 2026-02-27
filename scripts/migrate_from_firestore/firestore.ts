import admin from "firebase-admin"
import { getFirestore, Timestamp } from "firebase-admin/firestore"
import type { PaymentDocument } from "./types.ts"

let initialized = false

function initFirebase(projectId: string) {
  if (initialized) return
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  })
  initialized = true
}

/**
 * Firestoreから指定ユーザー・指定月の支払いデータを取得する
 *
 * @param projectId Firebase プロジェクトID
 * @param userId Firestore の ユーザーID
 * @param month "YYYY-MM" 形式の月指定
 */
export async function fetchPayments(
  projectId: string,
  userId: string,
  month: string,
): Promise<PaymentDocument[]> {
  initFirebase(projectId)

  const db = getFirestore()
  const collectionPath = `users/${userId}/payments`

  // 月の範囲を計算（UTCベース）
  const [year, mon] = month.split("-").map(Number)
  const startDate = new Date(Date.UTC(year, mon - 1, 1)) // 月初
  const endDate = new Date(Date.UTC(year, mon, 1)) // 翌月初

  const startTimestamp = Timestamp.fromDate(startDate)
  const endTimestamp = Timestamp.fromDate(endDate)

  const snapshot = await db
    .collection(collectionPath)
    .where("date", ">=", startTimestamp)
    .where("date", "<", endTimestamp)
    .get()

  // 月単位の取得のためページネーションは不要（データ量が限定的）
  const payments: PaymentDocument[] = []
  for (const doc of snapshot.docs) {
    const data = doc.data()
    // 必須フィールドの存在チェック
    if (
      !data.amount || !data.date || !data.created_date || !data.updated_date
    ) {
      console.warn(
        `警告: ドキュメント ${doc.id} に必須フィールドが不足しています。スキップします`,
      )
      continue
    }
    payments.push(data as PaymentDocument)
  }

  console.log(
    `Firestore: ${collectionPath} から ${month} の支払い ${payments.length}件取得`,
  )
  return payments
}

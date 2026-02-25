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

  // 月の範囲を計算
  const [year, mon] = month.split("-").map(Number)
  const startDate = new Date(year, mon - 1, 1) // 月初
  const endDate = new Date(year, mon, 1) // 翌月初

  const startTimestamp = Timestamp.fromDate(startDate)
  const endTimestamp = Timestamp.fromDate(endDate)

  const snapshot = await db
    .collection(collectionPath)
    .where("date", ">=", startTimestamp)
    .where("date", "<", endTimestamp)
    .get()

  const payments: PaymentDocument[] = []
  for (const doc of snapshot.docs) {
    payments.push(doc.data() as PaymentDocument)
  }

  console.log(
    `Firestore: ${collectionPath} から ${month} の支払い ${payments.length}件取得`,
  )
  return payments
}

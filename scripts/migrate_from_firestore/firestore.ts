import admin from "firebase-admin"
import { getFirestore } from "firebase-admin/firestore"
import type { PaymentDocument } from "./types.ts"

let initialized = false

let databaseId = "(default)"

function initFirebase(projectId: string, dbId?: string) {
  if (initialized) return
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  })
  if (dbId) databaseId = dbId
  // Deno環境ではgRPCが不安定なためREST APIを使用
  getFirestore(databaseId).settings({ preferRest: true })
  initialized = true
}

/**
 * Firestoreから指定ユーザーの支払いデータを取得する
 *
 * @param projectId Firebase プロジェクトID
 * @param userId Firestore の ユーザーID
 * @param month "YYYY-MM" 形式の月指定（省略時は全件取得）
 */
export async function fetchPayments(
  projectId: string,
  userId: string,
  month?: string,
  firestoreDatabaseId?: string,
): Promise<PaymentDocument[]> {
  initFirebase(projectId, firestoreDatabaseId)

  const db = getFirestore(databaseId)
  const collectionPath = `users/${userId}/payments`

  let startSeconds: number | undefined
  let endSeconds: number | undefined

  if (month) {
    // 月の範囲を計算
    const [year, mon] = month.split("-").map(Number)
    const startDate = new Date(year, mon - 1, 1) // 月初
    const endDate = new Date(year, mon, 1) // 翌月初

    startSeconds = Math.floor(startDate.getTime() / 1000)
    endSeconds = Math.floor(endDate.getTime() / 1000)
  }

  // REST APIモードではTimestampのwhere句が正しく動作しないため、
  // 全件取得してアプリ側でフィルタリングする
  const snapshot = await db.collection(collectionPath).get()

  if (month) {
    console.log(`  全${snapshot.size}件から対象月をフィルタリング中...`)
  } else {
    console.log(`  全${snapshot.size}件を取得中...`)
  }

  const payments: PaymentDocument[] = []
  for (const doc of snapshot.docs) {
    const data = doc.data()

    // 必須フィールドの存在チェック
    if (data.amount == null || !data.date) {
      console.warn(
        `  警告: ドキュメント ${doc.id} に必須フィールドが不足しています。スキップします`,
      )
      continue
    }

    // 月指定時のみ日付フィルタリング
    if (startSeconds != null && endSeconds != null) {
      const docSeconds = data.date._seconds ?? data.date.seconds
      if (
        docSeconds == null || docSeconds < startSeconds ||
        docSeconds >= endSeconds
      ) {
        continue
      }
    }

    payments.push(data as PaymentDocument)
  }

  // デバッグ: 0件の場合、全ドキュメントの月別件数を表示
  if (payments.length === 0 && snapshot.size > 0) {
    const monthCounts = new Map<string, number>()
    for (const doc of snapshot.docs) {
      const s = doc.data().date?._seconds ?? doc.data().date?.seconds
      if (s == null) continue
      const d = new Date(s * 1000)
      const ym = `${d.getFullYear()}-${
        String(d.getMonth() + 1).padStart(2, "0")
      }`
      monthCounts.set(ym, (monthCounts.get(ym) ?? 0) + 1)
    }
    const sorted = [...monthCounts.entries()].sort()
    console.log("  データが存在する月:")
    for (const [ym, count] of sorted) {
      console.log(`    ${ym}: ${count}件`)
    }
  }

  return payments
}

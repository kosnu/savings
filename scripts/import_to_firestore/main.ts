import "https://deno.land/std@0.224.0/dotenv/load.ts"
import { args } from "./src/config/args.ts"
import { env } from "./src/config/env.ts"
import { getAccessToken } from "./src/services/auth.ts"
import { parseCSV } from "./src/utils/csv.ts"
import { collectionMap, isCollectionKey } from "./src/utils/types.ts"
import { createPaymentDoc } from "./src/features/payment/createPaymentDoc.ts"
import { PaymentRecord } from "./src/features/payment/types.ts"
import { CategoryRecord } from "./src/features/category/types.ts"
import { createCategoryDoc } from "./src/features/category/createCategoryDoc.ts"

// 環境変数取得
const { serviceAccountKeyPath, database, projectId, userId } = env

if (!serviceAccountKeyPath || !database || !projectId || !userId) {
  console.error(
    "環境変数 SERVICE_ACCOUNT_KEY_PATH, FIRESTORE_DATABASE, FIRESTORE_PROJECT_ID, SAVINGS_USER_ID を設定してください。",
  )
  Deno.exit(1)
}

const collectionName = String(args.collection || args.c)

if (!collectionName) {
  console.error("コレクション名を指定してください。")
  Deno.exit(1)
}

if (!isCollectionKey(collectionName)) {
  console.error("無効なコレクション名です。")
  Deno.exit(1)
}

const csvDataPath = String(args.file || args.f)

if (!csvDataPath) {
  console.error("CSVファイルのパスを指定してください。")
  Deno.exit(1)
}

const access_token = await getAccessToken(serviceAccountKeyPath)
if (!access_token) {
  console.error("アクセストークンの取得に失敗しました。")
  Deno.exit(1)
}

// CSVファイル読み込み
const collection = collectionMap[collectionName]
const records = await parseCSV(csvDataPath, collection.columns)

if (records.length === 0) {
  console.error("CSVファイルにデータがありません。")
  Deno.exit(1)
}

if (collection.name === "categories") {
  // FIXME: 型安全に変換する
  const docs = records.map((record) => record as CategoryRecord)

  for (const doc of docs) {
    await createCategoryDoc(access_token, database, projectId, doc)
  }
}

if (collection.name === "payments") {
  // FIXME: 型安全に変換する
  const docs = records.map((record) => record as PaymentRecord)

  for (const doc of docs) {
    await createPaymentDoc(access_token, database, projectId, userId, doc)
  }
}

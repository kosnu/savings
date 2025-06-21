import "https://deno.land/std@0.224.0/dotenv/load.ts"
import { args } from "./src/config/args.ts"
import { env } from "./src/config/env.ts"
import { getAccessToken } from "./src/services/auth.ts"
import { addToCollection } from "./src/services/firestore.ts"
import { parseCSV } from "./src/utils/csv.ts"
import type { PaymentRecord } from "./src/utils/types.ts"

// 環境変数取得
const { serviceAccountKeyPath, projectId, userId } = env

if (!serviceAccountKeyPath || !projectId || !userId) {
  console.error(
    "環境変数 SERVICE_ACCOUNT_KEY_PATH, FIRESTORE_PROJECT_ID, SAVINGS_USER_ID を設定してください。",
  )
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
const csvRowNames = ["date", "category", "note", "amount"]
const records = await parseCSV<PaymentRecord>(csvDataPath, csvRowNames)

for (const record of records) {
  await addToCollection(access_token, projectId, userId, record)
}

import "jsr:@std/dotenv@^0.225/load"
import { parseArgs } from "@std/cli/parse-args"
import { loadCategoryMapping } from "./categories.ts"
import { fetchPayments } from "./firestore.ts"
import { mapPayment } from "./mapper.ts"
import { insertPayments } from "./supabase.ts"

function printUsage() {
  console.log(`使い方:
  deno task migrate -- --month <YYYY-MM> --firestore-user-id <ID>

オプション:
  --month              対象月 (例: 2025-01) [必須]
  --firestore-user-id  FirestoreのユーザーID [必須]
  --help               ヘルプを表示`)
}

function main() {
  const args = parseArgs(Deno.args, {
    string: ["month", "firestore-user-id"],
    boolean: ["help"],
  })

  if (args.help) {
    printUsage()
    Deno.exit(0)
  }

  const month = args.month
  const firestoreUserId = args["firestore-user-id"]

  if (!month || !firestoreUserId) {
    console.error("エラー: --month と --firestore-user-id は必須です")
    printUsage()
    Deno.exit(1)
  }

  // YYYY-MM 形式のバリデーション
  if (!/^\d{4}-\d{2}$/.test(month)) {
    console.error("エラー: --month は YYYY-MM 形式で指定してください")
    Deno.exit(1)
  }

  // 環境変数の取得
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!projectId || !supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      "エラー: FIREBASE_PROJECT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY を設定してください",
    )
    Deno.exit(1)
  }

  return {
    month,
    firestoreUserId,
    projectId,
    supabaseUrl,
    supabaseServiceRoleKey,
  }
}

const config = main()

// カテゴリマッピング読み込み（スクリプトディレクトリからの相対パス）
const scriptDir = new URL(".", import.meta.url).pathname
const csvPath = scriptDir + "../../categories.csv"
const categoryMapping = await loadCategoryMapping(csvPath)

// Firestoreからデータ取得
console.log(`\n対象月: ${config.month}`)
console.log(`Firestore ユーザーID: ${config.firestoreUserId}`)
const firestorePayments = await fetchPayments(
  config.projectId,
  config.firestoreUserId,
  config.month,
)

if (firestorePayments.length === 0) {
  console.log("\n対象データが0件のため終了します")
  Deno.exit(0)
}

// データ変換
const supabasePayments = firestorePayments.map((doc) =>
  mapPayment(doc, categoryMapping)
)

console.log(`\n変換結果: ${supabasePayments.length}件`)
console.log("サンプル (先頭1件):", JSON.stringify(supabasePayments[0], null, 2))

// Supabaseへインサート
await insertPayments(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  supabasePayments,
)

console.log(`\n移行完了: ${supabasePayments.length}件`)

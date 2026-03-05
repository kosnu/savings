import { load } from "@std/dotenv"
import { parseArgs } from "@std/cli/parse-args"
import { loadCategoryMapping } from "./categories.ts"
import { fetchPayments } from "./firestore.ts"
import { mapPayment } from "./mapper.ts"
import { insertPayments } from "./supabase.ts"

function printUsage() {
  console.log(`使い方:
  deno task migrate -- --firestore-user-id <ID> [--month <YYYY-MM>] [--firestore-database-id <DB_ID>]

オプション:
  --month                   対象月 (例: 2025-01) [省略時は全期間]
  --firestore-user-id       FirestoreのユーザーID [必須]
  --firestore-database-id   Firestoreデータベース名 (デフォルト: (default))
  --help                    ヘルプを表示`)
}

function main() {
  // deno task 経由で -- が渡された場合に除去する
  const rawArgs = Deno.args[0] === "--" ? Deno.args.slice(1) : Deno.args
  const args = parseArgs(rawArgs, {
    string: ["month", "firestore-user-id", "firestore-database-id"],
    boolean: ["help"],
  })

  if (args.help) {
    printUsage()
    Deno.exit(0)
  }

  const month = args.month
  const firestoreUserId = args["firestore-user-id"]

  if (!firestoreUserId) {
    console.error("エラー: --firestore-user-id は必須です")
    printUsage()
    Deno.exit(1)
  }

  if (month) {
    // YYYY-MM 形式のバリデーション
    if (!/^\d{4}-\d{2}$/.test(month)) {
      console.error("エラー: --month は YYYY-MM 形式で指定してください")
      Deno.exit(1)
    }

    // 月の範囲チェック (01-12)
    const monthNum = Number(month.split("-")[1])
    if (monthNum < 1 || monthNum > 12) {
      console.error("エラー: 月は 01〜12 の範囲で指定してください")
      Deno.exit(1)
    }
  }

  // 環境変数の取得
  const requiredEnvVars = [
    "FIREBASE_PROJECT_ID",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const
  const env = Object.fromEntries(
    requiredEnvVars.map((key) => [key, Deno.env.get(key)]),
  )
  const missing = requiredEnvVars.filter((key) => !env[key])
  if (missing.length > 0) {
    console.error(`エラー: 以下の環境変数が未設定です: ${missing.join(", ")}`)
    Deno.exit(1)
  }

  const projectId = env.FIREBASE_PROJECT_ID!
  const supabaseUrl = env.SUPABASE_URL!
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY!

  const firestoreDatabaseId = args["firestore-database-id"]

  return {
    month,
    firestoreUserId,
    firestoreDatabaseId,
    projectId,
    supabaseUrl,
    supabaseServiceRoleKey,
  }
}

function log(step: number, total: number, message: string) {
  console.log(`[${step}/${total}] ${message}`)
}

const TOTAL_STEPS = 5

try {
  // Step 1: 設定読み込み
  log(1, TOTAL_STEPS, "設定を読み込み中...")
  await load({ export: true })
  const config = main()
  console.log(`  対象月: ${config.month ?? "全期間"}`)
  console.log(`  Firestore ユーザーID: ${config.firestoreUserId}`)
  console.log(
    `  Firestore データベース: ${config.firestoreDatabaseId ?? "(default)"}`,
  )

  // Step 2: カテゴリマッピング読み込み
  log(2, TOTAL_STEPS, "カテゴリマッピングを読み込み中...")
  const scriptDir = import.meta.dirname!
  const csvPath = `${scriptDir}/../../categories.csv`
  const categoryMapping = await loadCategoryMapping(csvPath)
  console.log(`  ${categoryMapping.size}件のマッピングを読み込みました`)

  // Step 3: Firestoreからデータ取得
  log(3, TOTAL_STEPS, "Firestoreからデータを取得中...")
  const firestorePayments = await fetchPayments(
    config.projectId,
    config.firestoreUserId,
    config.month,
    config.firestoreDatabaseId,
  )
  console.log(`  ${firestorePayments.length}件取得しました`)

  if (firestorePayments.length === 0) {
    console.log("\n対象データが0件のため終了します")
    Deno.exit(0)
  }

  // Step 4: データ変換
  log(4, TOTAL_STEPS, "データを変換中...")
  const supabasePayments = firestorePayments.map((doc) =>
    mapPayment(doc, categoryMapping)
  )
  console.log(`  ${supabasePayments.length}件変換しました`)
  console.log(
    "  サンプル (先頭1件):",
    JSON.stringify(supabasePayments[0], null, 2),
  )

  // 実行前の確認プロンプト
  const answer = prompt(
    `\n${supabasePayments.length}件のデータをSupabaseにインサートしますか？ (y/N)`,
  )
  if (answer?.toLowerCase() !== "y") {
    console.log("キャンセルしました")
    Deno.exit(0)
  }

  // Step 5: Supabaseへインサート
  log(5, TOTAL_STEPS, "Supabaseにデータをインサート中...")
  await insertPayments(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    supabasePayments,
  )

  console.log(`\n移行完了: ${supabasePayments.length}件をインサートしました`)
} catch (error) {
  console.error(
    "\nエラーが発生しました:",
    error instanceof Error ? error.message : error,
  )
  Deno.exit(1)
}

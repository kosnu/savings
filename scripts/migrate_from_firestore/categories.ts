import { parse } from "@std/csv"
import type { CategoryMapping } from "./types.ts"

/**
 * プロジェクトルートの categories.csv を読み込み、
 * Firestore doc_id → Supabase db_id のマッピングを構築する
 */
export async function loadCategoryMapping(
  csvPath: string,
): Promise<CategoryMapping> {
  let text: string
  try {
    text = await Deno.readTextFile(csvPath)
  } catch (error) {
    throw new Error(
      `カテゴリCSVの読み込みに失敗しました (${csvPath}): ${
        error instanceof Error ? error.message : error
      }`,
    )
  }

  const records = parse(text, { skipFirstRow: true })

  if (records.length === 0) {
    throw new Error("カテゴリCSVにデータが含まれていません")
  }

  // 必須カラムの検証
  const firstRecord = records[0]
  if (!("doc_id" in firstRecord) || !("db_id" in firstRecord)) {
    throw new Error(
      "カテゴリCSVに必須カラム (doc_id, db_id) が含まれていません",
    )
  }

  const mapping: CategoryMapping = new Map()
  for (const record of records) {
    const docId = record.doc_id
    const dbId = Number(record.db_id)
    if (docId && !Number.isNaN(dbId)) {
      mapping.set(docId, dbId)
    }
  }

  console.log(`カテゴリマッピング: ${mapping.size}件読み込み`)
  return mapping
}

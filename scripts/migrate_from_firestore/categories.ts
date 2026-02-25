import { parse } from "@std/csv"
import type { CategoryMapping } from "./types.ts"

/**
 * プロジェクトルートの categories.csv を読み込み、
 * Firestore doc_id → Supabase db_id のマッピングを構築する
 */
export async function loadCategoryMapping(
  csvPath: string,
): Promise<CategoryMapping> {
  const text = await Deno.readTextFile(csvPath)
  const records = parse(text, { skipFirstRow: true })

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

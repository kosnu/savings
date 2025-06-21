import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts"

export async function parseCSV<Record>(
  filePath: string,
  columns: string[],
): Promise<Record[]> {
  const text = await Deno.readTextFile(filePath)
  const records = parse(text, {
    skipFirstRow: true,
    columns: columns,
  }) as Record[]
  return records
}

import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts"

export async function parseCSV(
  filePath: string,
  columns: ReadonlyArray<string>,
) {
  const text = await Deno.readTextFile(filePath)
  const records = parse(text, {
    skipFirstRow: true,
    columns: columns,
  })
  return records
}

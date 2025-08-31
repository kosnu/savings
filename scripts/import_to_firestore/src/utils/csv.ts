import { parse } from "@std/csv"

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

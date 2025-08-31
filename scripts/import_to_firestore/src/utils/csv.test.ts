import { assertEquals } from "@std/assert"
import { parseCSV } from "./csv.ts"

Deno.test("parseCSV: CSVファイルを正しくパースできる", async () => {
  const filePath = "./src/utils/test_data.csv"
  const columns = ["name", "age"]
  const result = await parseCSV(filePath, columns)

  assertEquals(result, [
    { name: "Alice", age: "30" },
    { name: "Bob", age: "25" },
  ])
})

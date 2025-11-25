import { assertEquals, assertThrows } from "@std/assert"
import { mapRowToCategory } from "./mapRowToCategory.ts"
import { CategoryRow } from "../../shared/types.ts"

Deno.test("mapRowToCategory success", () => {
  const row = createSampleRow({
    id: 1n,
    name: "Sample Category",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-02T00:00:00.000Z",
  })

  const category = mapRowToCategory(row)
  assertEquals(category.id.value, 1n)
  assertEquals(category.name.value, "Sample Category")
  assertEquals(category.createdAt.toISOString(), "2024-01-01T00:00:00.000Z")
  assertEquals(category.updatedAt.toISOString(), "2024-01-02T00:00:00.000Z")
})

Deno.test("mapRowToCategory with invalid created_at", () => {
  const row = createSampleRow({
    created_at: "invalid-date",
  })

  assertThrows(
    () => mapRowToCategory(row),
    "Invalid created_at value received from categories table",
  )
})

Deno.test("mapRowToCategory with invalid updated_at", () => {
  const row = createSampleRow({
    updated_at: "invalid-date",
  })

  assertThrows(
    () => mapRowToCategory(row),
    "Invalid updated_at value received from categories table",
  )
})

Deno.test("mapRowToCategory with invalid id", () => {
  const row = createSampleRow({
    id: -1n,
  })

  assertThrows(
    () => mapRowToCategory(row),
    "CategoryId must be a positive bigint",
  )
})

Deno.test("mapRowToCategory with invalid name", () => {
  const row = createSampleRow({
    name: "",
  })

  assertThrows(
    () => mapRowToCategory(row),
    "CategoryName cannot be empty",
  )
})

function createSampleRow(
  overrides: Partial<CategoryRow> = {},
): CategoryRow {
  return {
    id: 1n,
    name: "Sample Category",
    created_at: new Date("2024-01-01T00:00:00.000Z").toISOString(),
    updated_at: new Date("2024-01-02T00:00:00.000Z").toISOString(),
    ...overrides,
  }
}

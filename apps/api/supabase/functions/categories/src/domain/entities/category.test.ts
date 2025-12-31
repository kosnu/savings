import { assertEquals } from "@std/assert"
import { createCategoryId } from "../valueObjects/categoryId.ts"
import { createCategoryName } from "../valueObjects/categoryName.ts"
import { isErr } from "../../shared/result.ts"
import { createCategory } from "./category.ts"

Deno.test("createCategory success", () => {
  const idResult = createCategoryId(1n)
  if (isErr(idResult)) {
    throw new Error(idResult.error.message)
  }

  const nameResult = createCategoryName("Sample Category")
  if (isErr(nameResult)) {
    throw new Error(nameResult.error.message)
  }

  const createdAt = new Date("2024-01-01T00:00:00.000Z")
  const updatedAt = new Date("2024-01-02T00:00:00.000Z")

  const category = createCategory({
    id: idResult.value,
    name: nameResult.value,
    createdAt,
    updatedAt,
  })

  assertEquals(category.id.value, 1n)
  assertEquals(category.name.value, "Sample Category")
  assertEquals(category.createdAt.toISOString(), "2024-01-01T00:00:00.000Z")
  assertEquals(category.updatedAt.toISOString(), "2024-01-02T00:00:00.000Z")
})

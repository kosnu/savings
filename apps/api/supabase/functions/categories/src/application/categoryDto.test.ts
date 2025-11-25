import { assertEquals } from "@std/assert"
import { convertCategoryToDto } from "./categoryDto.ts"
import { createCategory } from "../domain/entities/category.ts"
import { createCategoryId } from "../domain/valueObjects/categoryId.ts"
import { createCategoryName } from "../domain/valueObjects/categoryName.ts"

Deno.test("toJson converts bigint to string", () => {
  const categoryId = createCategoryId(9007199254741991n)
  const categoryName = createCategoryName("Sample Category")
  const input = createCategory({
    id: categoryId.isOk ? categoryId.value : (() => {
      throw new Error("Invalid ID")
    })(),
    name: categoryName.isOk ? categoryName.value : (() => {
      throw new Error("Invalid Name")
    })(),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  })

  const output = convertCategoryToDto(input)
  assertEquals(output, {
    id: "9007199254741991",
    name: "Sample Category",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  })
})

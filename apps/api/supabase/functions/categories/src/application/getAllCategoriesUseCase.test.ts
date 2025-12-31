import { assert, assertEquals } from "@std/assert"
import type { CategoryRepository } from "../domain/repository.ts"
import { Category, createCategory } from "../domain/entities/category.ts"
import { createCategoryId } from "../domain/valueObjects/categoryId.ts"
import { createCategoryName } from "../domain/valueObjects/categoryName.ts"
import { DomainError, unexpectedError } from "../shared/errors.ts"
import { err, ok, Result } from "../shared/result.ts"
import { unwrapOk } from "../test/utils/unwrapOk.ts"
import { getAllCategoriesUseCase } from "./getAllCategoriesUseCase.ts"
import { convertCategoryToDto } from "./categoryDto.ts"

const makeRepository = (
  result: Promise<Result<ReadonlyArray<Category>, DomainError>>,
): CategoryRepository => ({
  findAll: () => result,
})

Deno.test("全カテゴリを取得できる", async () => {
  const category = createCategory({
    id: unwrapOk(createCategoryId(1n)),
    name: unwrapOk(createCategoryName("食費")),
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const categories: ReadonlyArray<Category> = [
    category,
  ]
  const expectedDtos = categories.map(convertCategoryToDto)
  const repository = makeRepository(
    Promise.resolve(ok(categories)),
  )
  const result = await getAllCategoriesUseCase(repository)

  assert(result.isOk)
  assertEquals(result.value, expectedDtos)
})

Deno.test("リポジトリの失敗を引き継ぐ", async () => {
  const error = unexpectedError("Database error")
  const repository = makeRepository(
    Promise.resolve(err(error)),
  )
  const result = await getAllCategoriesUseCase(repository)

  assertEquals(result, { isOk: false, error })
})

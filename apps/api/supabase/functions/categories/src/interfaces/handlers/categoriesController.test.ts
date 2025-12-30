import { assertEquals } from "@std/assert"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { createCategoriesController } from "./categoriesController.ts"
import { JSON_HEADERS } from "./errorResponse.ts"
import { err, ok } from "../../shared/result.ts"
import { CategoryDto } from "../../application/categoryDto.ts"
import type { CategoryRepository } from "../../domain/repository.ts"
import type { DomainError } from "../../shared/errors.ts"

type CategoriesControllerDeps = Parameters<
  typeof createCategoriesController
>[0]

const createController = (
  overrides: Partial<CategoriesControllerDeps>,
) => {
  const baseDeps: CategoriesControllerDeps = {
    createRepository: () => createCategoryRepositoryStub(),
    getAllUseCase: () => Promise.resolve(ok([])),
    createErrorResponse: () => new Response(null, { status: 500 }),
    jsonHeaders: JSON_HEADERS,
  }

  return createCategoriesController({ ...baseDeps, ...overrides })
}

const createCategoryRepositoryStub = (): CategoryRepository => {
  const findAll: CategoryRepository["findAll"] = async () => {
    throw new Error("category repository stub should not be called")
  }
  return { findAll }
}

Deno.test("カテゴリ取得成功時に200で結果を返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createCategoryRepositoryStub()
  const categories: ReadonlyArray<CategoryDto> = []
  const repositoryCalls: Array<{ supabase: SupabaseClient<Database> }> = []
  let receivedRepo: CategoryRepository | undefined

  const controller = createController({
    createRepository: (params) => {
      repositoryCalls.push(params)
      return repo
    },
    getAllUseCase: async (repository) => {
      receivedRepo = repository
      return ok(categories)
    },
    createErrorResponse: () => {
      throw new Error("createErrorResponse should not be called")
    },
  })

  const response = await controller.getAll(supabase)
  const body = await response.json()

  assertEquals(repositoryCalls, [{ supabase }])
  assertEquals(receivedRepo, repo)
  assertEquals(response.status, 200)
  assertEquals(body, { categories })
})

Deno.test("ユースケースエラー時はcreateErrorResponseの結果を返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createCategoryRepositoryStub()
  const error: DomainError = { type: "UnexpectedError", message: "boom" }
  const errorResponse = new Response(JSON.stringify({ error: "boom" }), {
    status: 503,
  })
  const repositoryCalls: Array<{ supabase: SupabaseClient<Database> }> = []
  let receivedUseCaseRepo: CategoryRepository | undefined
  let receivedError: DomainError | undefined

  const controller = createController({
    createRepository: (params) => {
      repositoryCalls.push(params)
      return repo
    },
    getAllUseCase: async (repository) => {
      receivedUseCaseRepo = repository
      return err(error)
    },
    createErrorResponse: (givenError) => {
      receivedError = givenError
      return errorResponse
    },
  })

  const response = await controller.getAll(supabase)
  const body = await response.json()

  assertEquals(repositoryCalls, [{ supabase }])
  assertEquals(receivedUseCaseRepo, repo)
  assertEquals(receivedError, error)
  assertEquals(response.status, 503)
  assertEquals(body, { error: "boom" })
})

Deno.test("成功レスポンスにJSONヘッダーを設定する", async () => {
  const client = {} as SupabaseClient<Database>
  const repository = createCategoryRepositoryStub()

  const controller = createController({
    createRepository: () => repository,
    getAllUseCase: async () => {
      const dto: CategoryDto = {
        id: "cat",
        name: "Misc",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      }
      return ok([dto])
    },
  })

  const response = await controller.getAll(client)

  assertEquals(
    response.headers.get("content-type"),
    JSON_HEADERS["content-type"],
  )
})

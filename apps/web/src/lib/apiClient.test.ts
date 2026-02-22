import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest"
import {
  DomainValidationError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./apiErrors"

vi.mock("./supabase", () => ({
  getSupabaseClient: vi.fn(),
}))

vi.mock("../config/env", () => ({
  env: { SUPABASE_URL: "http://localhost:54321" },
}))

import { apiClient, buildFunctionUrl } from "./apiClient"
import { getSupabaseClient } from "./supabase"

const mockGetSession = vi.fn()

function mockSession(accessToken: string) {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: accessToken } },
    error: null,
  })
}

function mockNoSession() {
  mockGetSession.mockResolvedValue({
    data: { session: null },
    error: null,
  })
}

function mockFetch(status: number, body?: unknown): Mock {
  const fn = vi.fn<() => Promise<Response>>().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as Response)
  globalThis.fetch = fn
  return fn
}

beforeEach(() => {
  ;(getSupabaseClient as Mock).mockReturnValue({
    auth: { getSession: mockGetSession },
  })
  mockSession("test-token")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("buildFunctionUrl", () => {
  it("関数名のみでURLを組み立てる", () => {
    expect(buildFunctionUrl("payments")).toBe(
      "http://localhost:54321/functions/v1/payments",
    )
  })

  it("パス付きでURLを組み立てる", () => {
    expect(buildFunctionUrl("payments", "/123")).toBe(
      "http://localhost:54321/functions/v1/payments/123",
    )
  })
})

describe("apiClient", () => {
  describe("認証", () => {
    it("Authorizationヘッダーにトークンを付与する", async () => {
      const fetchMock = mockFetch(200, { data: "ok" })

      await apiClient.get("http://localhost:54321/functions/v1/payments")

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:54321/functions/v1/payments",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      )
    })

    it("セッションがない場合 UnauthorizedError をthrowする", async () => {
      mockNoSession()

      await expect(
        apiClient.get("http://localhost:54321/functions/v1/payments"),
      ).rejects.toThrow(UnauthorizedError)
    })
  })

  describe("HTTPメソッド", () => {
    it.each([
      "get",
      "post",
      "put",
      "delete",
      "patch",
    ] as const)("%s メソッドでリクエストする", async (method) => {
      const fetchMock = mockFetch(200, {})

      await apiClient[method]("http://localhost:54321/test")

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:54321/test",
        expect.objectContaining({
          method: method.toUpperCase(),
        }),
      )
    })
  })

  describe("リクエストオプション", () => {
    it("クエリパラメータをURLに付与する", async () => {
      const fetchMock = mockFetch(200, {})

      await apiClient.get("http://localhost:54321/test", {
        params: { dateFrom: "2024-01-01", dateTo: "2024-12-31" },
      })

      const calledUrl = fetchMock.mock.calls[0][0] as string
      expect(calledUrl).toContain("dateFrom=2024-01-01")
      expect(calledUrl).toContain("dateTo=2024-12-31")
    })

    it("undefinedのパラメータを除外する", async () => {
      const fetchMock = mockFetch(200, {})

      await apiClient.get("http://localhost:54321/test", {
        params: { dateFrom: "2024-01-01", dateTo: undefined },
      })

      const calledUrl = fetchMock.mock.calls[0][0] as string
      expect(calledUrl).toContain("dateFrom=2024-01-01")
      expect(calledUrl).not.toContain("dateTo")
    })

    it("bodyをJSON文字列化して送信する", async () => {
      const fetchMock = mockFetch(200, {})
      const body = { name: "Test", amount: 100 }

      await apiClient.post("http://localhost:54321/test", { body })

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:54321/test",
        expect.objectContaining({
          body: JSON.stringify(body),
        }),
      )
    })

    it("fetchOptionsを渡せる", async () => {
      const controller = new AbortController()
      const fetchMock = mockFetch(200, {})

      await apiClient.get("http://localhost:54321/test", {
        fetchOptions: { signal: controller.signal },
      })

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:54321/test",
        expect.objectContaining({
          signal: controller.signal,
        }),
      )
    })
  })

  describe("レスポンスハンドリング", () => {
    it("成功レスポンスをパースして返す", async () => {
      mockFetch(200, { payments: [{ id: "1" }] })

      const result = await apiClient.get<{ payments: { id: string }[] }>(
        "http://localhost:54321/test",
      )

      expect(result).toEqual({ payments: [{ id: "1" }] })
    })

    it("401で UnauthorizedError をthrowする", async () => {
      mockFetch(401, { message: "Token expired" })

      await expect(
        apiClient.get("http://localhost:54321/test"),
      ).rejects.toThrow(UnauthorizedError)
    })

    it("400 + fieldErrors で ValidationError をthrowする", async () => {
      mockFetch(400, {
        fieldErrors: { name: ["Required"] },
        formErrors: [],
      })

      const error = await apiClient
        .post("http://localhost:54321/test")
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).fieldErrors).toEqual({
        name: ["Required"],
      })
    })

    it("400 + fieldErrors のみ で ValidationError をthrowし、formErrors はデフォルト値になる", async () => {
      mockFetch(400, {
        fieldErrors: { email: ["Invalid"] },
      })

      const error = await apiClient
        .post("http://localhost:54321/test")
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.fieldErrors).toEqual({
        email: ["Invalid"],
      })
      expect(validationError.formErrors).toEqual([])
    })

    it("400 + formErrors のみ で ValidationError をthrowし、fieldErrors はデフォルト値になる", async () => {
      mockFetch(400, {
        formErrors: ["Invalid data"],
      })

      const error = await apiClient
        .post("http://localhost:54321/test")
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.formErrors).toEqual(["Invalid data"])
      expect(validationError.fieldErrors).toEqual({})
    })
    it("400 + message で DomainValidationError をthrowする", async () => {
      mockFetch(400, { message: "Duplicate entry" })

      const error = await apiClient
        .post("http://localhost:54321/test")
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DomainValidationError)
      expect((error as DomainValidationError).message).toBe("Duplicate entry")
    })

    it("404で NotFoundError をthrowする", async () => {
      mockFetch(404, { message: "Payment not found" })

      await expect(
        apiClient.get("http://localhost:54321/test"),
      ).rejects.toThrow(NotFoundError)
    })

    it("500で InternalServerError をthrowする", async () => {
      mockFetch(500, {
        message: "DB error",
        details: "Connection refused",
        hint: "Check DB",
        code: "PGRST301",
      })

      const error = await apiClient
        .get("http://localhost:54321/test")
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(InternalServerError)
      const serverError = error as InternalServerError
      expect(serverError.message).toBe("DB error")
      expect(serverError.details).toBe("Connection refused")
      expect(serverError.hint).toBe("Check DB")
      expect(serverError.code).toBe("PGRST301")
    })
  })
})

import { describe, expect, it } from "vitest"
import {
  ApiError,
  DomainValidationError,
  InternalServerError,
  isApiError,
  isDomainValidationError,
  isInternalServerError,
  isNotFoundError,
  isUnauthorizedError,
  isValidationError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./apiErrors"

describe("ApiError", () => {
  it("status と message を保持する", () => {
    const error = new ApiError(418, "I'm a teapot")
    expect(error.status).toBe(418)
    expect(error.message).toBe("I'm a teapot")
    expect(error.name).toBe("ApiError")
    expect(error).toBeInstanceOf(Error)
  })
})

describe("UnauthorizedError", () => {
  it("デフォルトメッセージで生成できる", () => {
    const error = new UnauthorizedError()
    expect(error.status).toBe(401)
    expect(error.message).toBe("Unauthorized")
    expect(error.name).toBe("UnauthorizedError")
  })

  it("カスタムメッセージで生成できる", () => {
    const error = new UnauthorizedError("Session expired")
    expect(error.message).toBe("Session expired")
  })
})

describe("ValidationError", () => {
  it("fieldErrors と formErrors を保持する", () => {
    const error = new ValidationError({
      fieldErrors: { name: ["Required"] },
      formErrors: ["Invalid form"],
    })
    expect(error.status).toBe(400)
    expect(error.name).toBe("ValidationError")
    expect(error.fieldErrors).toEqual({ name: ["Required"] })
    expect(error.formErrors).toEqual(["Invalid form"])
  })
})

describe("DomainValidationError", () => {
  it("message と details を保持する", () => {
    const error = new DomainValidationError({
      message: "Duplicate entry",
      details: "Name already exists",
    })
    expect(error.status).toBe(400)
    expect(error.name).toBe("DomainValidationError")
    expect(error.message).toBe("Duplicate entry")
    expect(error.details).toBe("Name already exists")
  })

  it("details なしで生成できる", () => {
    const error = new DomainValidationError({ message: "Invalid" })
    expect(error.details).toBeUndefined()
  })
})

describe("NotFoundError", () => {
  it("デフォルトメッセージで生成できる", () => {
    const error = new NotFoundError()
    expect(error.status).toBe(404)
    expect(error.message).toBe("Not Found")
    expect(error.name).toBe("NotFoundError")
  })
})

describe("InternalServerError", () => {
  it("すべてのプロパティを保持する", () => {
    const error = new InternalServerError({
      message: "DB error",
      details: "Connection refused",
      hint: "Check DB status",
      code: "PGRST301",
    })
    expect(error.status).toBe(500)
    expect(error.name).toBe("InternalServerError")
    expect(error.message).toBe("DB error")
    expect(error.details).toBe("Connection refused")
    expect(error.hint).toBe("Check DB status")
    expect(error.code).toBe("PGRST301")
  })

  it("デフォルト値で生成できる", () => {
    const error = new InternalServerError()
    expect(error.message).toBe("Internal Server Error")
  })
})

describe("型ガード関数", () => {
  const errors = {
    unauthorized: new UnauthorizedError(),
    validation: new ValidationError({ fieldErrors: {}, formErrors: [] }),
    domainValidation: new DomainValidationError({ message: "err" }),
    notFound: new NotFoundError(),
    internalServer: new InternalServerError(),
    api: new ApiError(418, "teapot"),
  }

  it("isUnauthorizedError", () => {
    expect(isUnauthorizedError(errors.unauthorized)).toBe(true)
    expect(isUnauthorizedError(errors.validation)).toBe(false)
    expect(isUnauthorizedError(new Error())).toBe(false)
  })

  it("isValidationError", () => {
    expect(isValidationError(errors.validation)).toBe(true)
    expect(isValidationError(errors.domainValidation)).toBe(false)
  })

  it("isDomainValidationError", () => {
    expect(isDomainValidationError(errors.domainValidation)).toBe(true)
    expect(isDomainValidationError(errors.validation)).toBe(false)
  })

  it("isNotFoundError", () => {
    expect(isNotFoundError(errors.notFound)).toBe(true)
    expect(isNotFoundError(errors.api)).toBe(false)
  })

  it("isInternalServerError", () => {
    expect(isInternalServerError(errors.internalServer)).toBe(true)
    expect(isInternalServerError(errors.api)).toBe(false)
  })

  it("isApiError はすべてのサブクラスに対して true を返す", () => {
    for (const error of Object.values(errors)) {
      expect(isApiError(error)).toBe(true)
    }
    expect(isApiError(new Error())).toBe(false)
    expect(isApiError("string")).toBe(false)
  })
})

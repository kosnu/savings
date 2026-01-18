// ドメイン層で使うエラー表現（クラスは使わず plain object）
export type DomainError =
  | ValidationError
  | NotFoundError
  | UnexpectedError

export type ValidationError = {
  type: "ValidationError"
  message: string
  details?: Record<string, unknown>
}

export type NotFoundError = {
  type: "NotFoundError"
  message: string
  target?: string
}

export type UnexpectedError = {
  type: "UnexpectedError"
  message: string
  original?: unknown
}

export const validationError = (
  message: string,
  details?: Record<string, unknown>,
): ValidationError => ({
  type: "ValidationError",
  message,
  details,
})

export const notFoundError = (
  message: string,
  target?: string,
): NotFoundError => ({
  type: "NotFoundError",
  message,
  target,
})

export const unexpectedError = (
  message: string,
  original?: unknown,
): UnexpectedError => ({
  type: "UnexpectedError",
  message,
  original,
})

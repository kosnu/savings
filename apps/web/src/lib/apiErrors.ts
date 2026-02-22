export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message)
    this.name = "UnauthorizedError"
  }
}

export interface ValidationErrorBody {
  fieldErrors: Record<string, string[]>
  formErrors: string[]
}

export class ValidationError extends ApiError {
  readonly fieldErrors: Record<string, string[]>
  readonly formErrors: string[]

  constructor(body: ValidationErrorBody) {
    super(400, "Validation failed")
    this.name = "ValidationError"
    this.fieldErrors = body.fieldErrors
    this.formErrors = body.formErrors
  }
}

export interface DomainValidationErrorBody {
  message: string
  details?: string
}

export class DomainValidationError extends ApiError {
  readonly details?: string

  constructor(body: DomainValidationErrorBody) {
    super(400, body.message)
    this.name = "DomainValidationError"
    this.details = body.details
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not Found") {
    super(404, message)
    this.name = "NotFoundError"
  }
}

export interface InternalServerErrorBody {
  message?: string
  details?: string
  hint?: string
  code?: string
}

export class InternalServerError extends ApiError {
  readonly details?: string
  readonly hint?: string
  readonly code?: string

  constructor(body: InternalServerErrorBody = {}) {
    super(500, body.message ?? "Internal Server Error")
    this.name = "InternalServerError"
    this.details = body.details
    this.hint = body.hint
    this.code = body.code
  }
}

export function isUnauthorizedError(
  error: unknown,
): error is UnauthorizedError {
  return error instanceof UnauthorizedError
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

export function isDomainValidationError(
  error: unknown,
): error is DomainValidationError {
  return error instanceof DomainValidationError
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError
}

export function isInternalServerError(
  error: unknown,
): error is InternalServerError {
  return error instanceof InternalServerError
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

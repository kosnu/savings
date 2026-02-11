import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type UserId = {
  value: Readonly<number>
}

export function createUserId(
  value: number,
): Result<UserId, DomainError> {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return err(
      validationError("UserId must be a positive integer", { value }),
    )
  }

  return ok({ value })
}

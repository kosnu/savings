import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type UserId = {
  value: Readonly<bigint>
}

export function createUserId(
  value: bigint,
): Result<UserId, DomainError> {
  if (value <= 0n) {
    return err(
      validationError("UserId must be a positive bigint", { value }),
    )
  }

  return ok({ value })
}

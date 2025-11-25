import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type CategoryId = {
  value: Readonly<bigint>
}

export function createCategoryId(
  value: bigint,
): Result<CategoryId, DomainError> {
  if (value <= 0n) {
    return err(
      validationError("CategoryId must be a positive bigint", { value }),
    )
  }

  return ok({ value })
}

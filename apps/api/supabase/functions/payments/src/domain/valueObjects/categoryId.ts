import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type CategoryId = {
  value: Readonly<number>
}

export function createCategoryId(
  value: number,
): Result<CategoryId, DomainError> {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return err(
      validationError("CategoryId must be a positive integer", { value }),
    )
  }

  return ok({ value })
}

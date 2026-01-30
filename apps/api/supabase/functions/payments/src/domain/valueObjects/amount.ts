import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type Amount = {
  value: Readonly<number>
}

export function createAmount(
  value: number,
): Result<Amount, DomainError> {
  if (!Number.isInteger(value)) {
    return err(
      validationError("Amount must be an integer", { value }),
    )
  }

  return ok({ value })
}

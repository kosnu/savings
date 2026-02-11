import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type PaymentId = {
  value: Readonly<number>
}

export function createPaymentId(
  value: number,
): Result<PaymentId, DomainError> {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return err(
      validationError("PaymentId must be a positive integer", { value }),
    )
  }

  return ok({ value })
}

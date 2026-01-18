import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type PaymentId = {
  value: Readonly<bigint>
}

export function createPaymentId(
  value: bigint,
): Result<PaymentId, DomainError> {
  if (value <= 0n) {
    return err(
      validationError("PaymentId must be a positive bigint", { value }),
    )
  }

  return ok({ value })
}

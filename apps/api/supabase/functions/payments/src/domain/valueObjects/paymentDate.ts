import { ok, Result } from "../../shared/result.ts"
import { type DomainError } from "../../shared/errors.ts"

export type PaymentDate = {
  value: Readonly<Date>
}

export function createPaymentDate(
  value: Date,
): Result<PaymentDate, DomainError> {
  return ok({ value })
}

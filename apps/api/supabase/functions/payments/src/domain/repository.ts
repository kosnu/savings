import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"
import { Payment } from "./entities/payment.ts"

export type PaymentSearchParams = {
  readonly userId: bigint
  readonly dateFrom?: string
  readonly dateTo?: string
}

export interface PaymentRepository {
  search(
    params: PaymentSearchParams,
  ): Promise<Result<ReadonlyArray<Payment>, DomainError>>
}

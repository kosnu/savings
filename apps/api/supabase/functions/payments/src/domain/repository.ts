import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"

export type PaymentMonthlyTotalParams = {
  readonly month: string
}

export interface PaymentRepository {
  monthlyTotal(
    params: PaymentMonthlyTotalParams,
  ): Promise<Result<number, DomainError>>
}

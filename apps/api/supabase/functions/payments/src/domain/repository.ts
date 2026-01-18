import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"
import { Payment } from "./entities/payment.ts"

export interface PaymentRepository {
  search(): Promise<Result<ReadonlyArray<Payment>, DomainError>>
}

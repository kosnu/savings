import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"
import { Payment } from "./entities/payment.ts"
import { Amount } from "./valueObjects/amount.ts"
import { CategoryId } from "./valueObjects/categoryId.ts"
import { Note } from "./valueObjects/note.ts"
import { PaymentDate } from "./valueObjects/paymentDate.ts"
import { UserId } from "./valueObjects/userId.ts"

export type PaymentSearchParams = {
  readonly userId: number
  readonly dateFrom?: string
  readonly dateTo?: string
}

export type PaymentCreateParams = {
  readonly userId: UserId
  readonly amount: Amount
  readonly date: PaymentDate
  readonly note: Note
  readonly categoryId: CategoryId | null
}

export interface PaymentRepository {
  search(
    params: PaymentSearchParams,
  ): Promise<Result<ReadonlyArray<Payment>, DomainError>>
  create(
    params: PaymentCreateParams,
  ): Promise<Result<Payment, DomainError>>
}

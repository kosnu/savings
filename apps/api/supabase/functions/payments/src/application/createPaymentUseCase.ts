import { createAmount } from "../domain/valueObjects/amount.ts"
import { createCategoryId } from "../domain/valueObjects/categoryId.ts"
import { createNote } from "../domain/valueObjects/note.ts"
import { createPaymentDate } from "../domain/valueObjects/paymentDate.ts"
import { createUserId } from "../domain/valueObjects/userId.ts"
import { PaymentRepository } from "../domain/repository.ts"
import { DomainError, validationError } from "../shared/errors.ts"
import { err, ok, Result } from "../shared/result.ts"
import { Payment } from "../domain/entities/payment.ts"

export async function createPaymentUseCase(
  params: CreatePaymentInput,
  paymentRepository: PaymentRepository,
): Promise<Result<Payment, DomainError>> {
  const dateResult = parsePaymentDate(params.date)
  if (!dateResult.isOk) {
    return dateResult
  }

  const userIdResult = createUserId(params.userId)
  if (!userIdResult.isOk) {
    return userIdResult
  }

  const amountResult = createAmount(params.amount)
  if (!amountResult.isOk) {
    return amountResult
  }

  const noteResult = createNote(params.note)
  if (!noteResult.isOk) {
    return noteResult
  }

  const categoryResult = params.categoryId === null
    ? null
    : createCategoryId(params.categoryId)
  if (categoryResult !== null && !categoryResult.isOk) {
    return categoryResult
  }

  const paymentDateResult = createPaymentDate(dateResult.value)
  if (!paymentDateResult.isOk) {
    return paymentDateResult
  }

  return await paymentRepository.create({
    userId: userIdResult.value,
    amount: amountResult.value,
    date: paymentDateResult.value,
    note: noteResult.value,
    categoryId: categoryResult === null ? null : categoryResult.value,
  })
}

export type CreatePaymentInput = {
  readonly userId: number
  readonly amount: number
  readonly date: string
  readonly note: string | null
  readonly categoryId: number | null
}

function parsePaymentDate(
  value: string,
): Result<Date, DomainError> {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    return err(
      validationError("date must be YYYY-MM-DD", { date: value }),
    )
  }

  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return err(
      validationError("date is invalid", { date: value }),
    )
  }

  return ok(parsed)
}

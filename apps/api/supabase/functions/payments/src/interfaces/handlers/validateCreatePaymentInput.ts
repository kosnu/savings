import { validationError } from "../../shared/errors.ts"
import { err, ok, Result } from "../../shared/result.ts"
import type { DomainError } from "../../shared/errors.ts"

export type CreatePaymentInput = {
  amount: number
  date: string
  note: string | null
  categoryId: number | null
}

export function validateCreatePaymentInput(
  input: unknown,
): Result<CreatePaymentInput, DomainError> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return err(validationError("body must be an object"))
  }

  const record = input as Record<string, unknown>

  const amount = record.amount
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return err(validationError("amount must be a number", { amount }))
  }

  const date = record.date
  if (typeof date !== "string") {
    return err(validationError("date must be a string", { date }))
  }

  const noteValue = record.note
  if (
    noteValue !== undefined && noteValue !== null &&
    typeof noteValue !== "string"
  ) {
    return err(
      validationError("note must be a string or null", { note: noteValue }),
    )
  }

  const note = noteValue === ""
    ? null
    : (noteValue as string | null | undefined) ?? null

  const categoryValue = record.categoryId
  if (categoryValue === undefined || categoryValue === null) {
    return ok({ amount, date, note, categoryId: null })
  }

  if (typeof categoryValue !== "number" || !Number.isInteger(categoryValue)) {
    return err(
      validationError("categoryId must be an integer", {
        categoryId: categoryValue,
      }),
    )
  }

  return ok({
    amount,
    date,
    note,
    categoryId: categoryValue,
  })
}

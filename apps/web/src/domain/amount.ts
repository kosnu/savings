import * as z from "zod"

const DECIMAL_NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/

const amountInputSchema = z.union([z.string(), z.number(), z.undefined()])

const amountNumberSchema = z
  .number({
    error: (iss) => {
      if (iss.input === undefined || iss.input === null || iss.input === "") {
        return "Amount cannot be empty"
      }
      if (typeof iss.input !== "number" || Number.isNaN(iss.input)) {
        return "Amount must be a number"
      }
      return "Amount is invalid"
    },
  })
  .int("Amount must be an integer")
  .nonnegative("Amount must be a non-negative integer")

export const amountFieldSchema = amountInputSchema
  .transform(normalizeAmountValue)
  .pipe(amountNumberSchema)

export const optionalAmountFieldSchema = amountInputSchema
  .transform(normalizeAmountValue)
  .pipe(amountNumberSchema.optional())

export function toAmountFormValue(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined

  return String(value)
}

function normalizeAmountValue(value: unknown): unknown {
  if (typeof value !== "string") return value

  const trimmedValue = value.trim()
  if (trimmedValue === "") return undefined

  if (!DECIMAL_NUMBER_PATTERN.test(trimmedValue)) return trimmedValue

  const numericValue = Number(trimmedValue)

  if (Number.isNaN(numericValue)) return trimmedValue

  return numericValue
}

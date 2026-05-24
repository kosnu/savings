import * as z from "zod"

import { normalizeAmountInputValue } from "../../utils/amountInputValue"

export const PAYMENT_NOTE_MAX_LENGTH = 30

export const categoryFieldSchema = z.string()

export const dateFieldSchema = z.date({
  error: (iss) => {
    if (iss.input === undefined || iss.input === null || iss.input === "") {
      return "Date cannot be empty"
    }
    return "Date is invalid"
  },
})

export const noteFieldSchema = z
  .string()
  .max(PAYMENT_NOTE_MAX_LENGTH, `Note must be ${PAYMENT_NOTE_MAX_LENGTH} characters or less`)

const amountInputSchema = z.union([z.string(), z.number(), z.undefined()])

export const amountFieldSchema = amountInputSchema.transform(normalizeAmountInputValue).pipe(
  z
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
    .nonnegative("Amount must be a non-negative integer"),
)

const baseSchema = z.object({
  category: categoryFieldSchema,
  date: dateFieldSchema,
  note: noteFieldSchema,
  amount: amountFieldSchema,
})

export const paymentFormSchema = baseSchema.partial({
  date: true,
  amount: true,
})

export const paymentFormSubmitSchema = baseSchema.required({
  date: true,
  amount: true,
})

export interface PaymentFormValues {
  category: string
  date?: Date
  note: string
  amount?: string | number
}

export type PaymentFormSubmitValues = z.infer<typeof paymentFormSubmitSchema>
export type PaymentFormError = z.core.$ZodFlattenedError<PaymentFormValues>

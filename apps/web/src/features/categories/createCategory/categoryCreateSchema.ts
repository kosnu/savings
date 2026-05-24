import * as z from "zod"

import { normalizeAmountInputValue } from "../../../utils/amountInputValue"
import { categoryNameSchema } from "../categorySchema"

const amountInputSchema = z.union([z.string(), z.number(), z.undefined()])

const budgetAmountSchema = amountInputSchema.transform(normalizeAmountInputValue).pipe(
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
    .nonnegative("Amount must be a non-negative integer")
    .optional(),
)

const baseSchema = z.object({
  name: categoryNameSchema,
  budgetAmount: budgetAmountSchema.optional(),
})

export const categoryCreateSchema = baseSchema.required({
  name: true,
})

export interface CategoryCreateFormValues {
  name: string
  budgetAmount?: string | number
}

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>

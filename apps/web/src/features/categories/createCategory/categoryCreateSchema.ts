import * as z from "zod"

import { categoryNameSchema } from "../categorySchema"

const budgetAmountSchema = z
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

const baseSchema = z.object({
  name: categoryNameSchema,
  budgetAmount: budgetAmountSchema.optional(),
})

export const categoryCreateSchema = baseSchema.required({
  name: true,
})

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>

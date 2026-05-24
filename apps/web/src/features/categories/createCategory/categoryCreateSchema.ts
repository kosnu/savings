import * as z from "zod"

import { optionalAmountFieldSchema } from "../../../domain/amount"
import { categoryNameSchema } from "../categorySchema"

const baseSchema = z.object({
  name: categoryNameSchema,
  budgetAmount: optionalAmountFieldSchema.optional(),
})

export const categoryCreateSchema = baseSchema.required({
  name: true,
})

export interface CategoryCreateFormValues {
  name: string
  budgetAmount?: string | number
}

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>

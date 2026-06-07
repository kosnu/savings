import * as z from "zod"

import { categoryBudgetInputSchema } from "../categoryBudget"
import { categoryNameSchema } from "../categorySchema"

const baseSchema = z.object({
  name: categoryNameSchema,
  pinned: z.boolean(),
  budgetAmount: categoryBudgetInputSchema,
})

export const categoryCreateSchema = baseSchema.required({
  name: true,
  pinned: true,
  budgetAmount: true,
})

export const categoryCreateValuesSchema = z.object({
  name: categoryNameSchema,
  pinned: z.boolean(),
  budgetAmount: z.number().int().nonnegative().nullable(),
})

export interface CategoryCreateFormValues {
  name: string
  pinned: boolean
  budgetAmount: string
}

export type CategoryCreateValues = z.infer<typeof categoryCreateValuesSchema>

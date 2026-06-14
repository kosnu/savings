import * as z from "zod"

import { optionalAmountFieldSchema } from "../../../domain/amount"
import { categoryNameSchema } from "../categorySchema"

const baseSchema = z.object({
  name: categoryNameSchema,
  budgetAmount: optionalAmountFieldSchema,
  pinned: z.boolean(),
})

export const categoryCreateSchema = baseSchema.required({
  name: true,
  pinned: true,
})

export interface CategoryCreateFormValues {
  name: string
  budgetAmount: string | number | undefined
  pinned: boolean
}

export interface CategoryCreateValues {
  name: string
  budgetAmount?: string | number | undefined
  pinned: boolean
}

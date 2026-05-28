import * as z from "zod"

import { categoryNameSchema } from "../categorySchema"

const baseSchema = z.object({
  name: categoryNameSchema,
})

export const categoryCreateSchema = baseSchema.required({
  name: true,
})

export interface CategoryCreateFormValues {
  name: string
}

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>

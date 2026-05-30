import * as z from "zod"

import { categoryNameSchema } from "../categorySchema"

const baseSchema = z.object({
  name: categoryNameSchema,
  pinned: z.boolean(),
})

export const categoryCreateSchema = baseSchema.required({
  name: true,
  pinned: true,
})

export interface CategoryCreateFormValues {
  name: string
  pinned: boolean
}

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>

import * as z from "@zod/zod"

export const MonthCriteriaSchema = z.object({
  userId: z.number().positive(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
})

export type MonthCriteria = z.infer<typeof MonthCriteriaSchema>

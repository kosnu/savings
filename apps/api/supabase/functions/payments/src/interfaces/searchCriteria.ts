import * as z from "@zod/zod"

export const SearchCriteriaSchema = z.object({
  userId: z.number().positive(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
})

export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>

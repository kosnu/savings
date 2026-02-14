import * as z from "@zod/zod"

export const SearchCriteriaSchema = z.object({
  userId: z.number().positive(),
  dateFrom: z.iso.date().optional().default(undefined),
  dateTo: z.iso.date().optional().default(undefined),
})

export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>

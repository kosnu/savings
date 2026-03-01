import { z } from "zod"

export const paymentsSearchSchema = z.object({
  year: z.coerce.string().optional(),
  month: z.coerce.string().optional(),
})

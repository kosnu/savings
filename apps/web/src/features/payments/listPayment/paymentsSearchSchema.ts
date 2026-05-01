import { z } from "zod"

export const PAYMENT_SEARCH_CATEGORY_NONE_VALUE = "none"

const paymentSearchCategoryIdSchema = z.coerce.string().pipe(z.templateLiteral([z.number()]))
const paymentSearchCategorySchema = z
  .union([z.literal(PAYMENT_SEARCH_CATEGORY_NONE_VALUE), paymentSearchCategoryIdSchema])
  .optional()
  .catch(undefined)

export const paymentsSearchSchema = z.object({
  year: z.coerce.string().optional(),
  month: z.coerce.string().optional(),
  category: paymentSearchCategorySchema,
})

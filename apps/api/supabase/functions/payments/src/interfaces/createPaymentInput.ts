import * as z from "@zod/zod"

const NullableNoteSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((note) => {
    if (note === "" || note === null || note === undefined) {
      return null
    }

    return note
  })

const NullableCategoryIdSchema = z
  .union([z.number().int(), z.null(), z.undefined()])
  .transform((categoryId) => categoryId ?? null)

export const CreatePaymentInputSchema = z.object({
  amount: z.number().finite(),
  date: z.string(),
  note: NullableNoteSchema,
  categoryId: NullableCategoryIdSchema,
})

export type CreatePaymentInput = z.infer<typeof CreatePaymentInputSchema>

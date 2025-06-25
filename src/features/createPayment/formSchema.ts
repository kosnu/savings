import z from "zod/v4"

export const formShema = z.object({
  category: z.string().nonempty(),
  date: z.iso.datetime().transform((value) => new Date(value.toString())),
  note: z.string(),
  amount: z
    .string()
    .transform((value) => Number(value.toString().replace(/,/g, "")))
    .refine((val) => !Number.isNaN(val), {
      message: "amount must be a valid number",
    }),
})

export type FormSchema = z.infer<typeof formShema>

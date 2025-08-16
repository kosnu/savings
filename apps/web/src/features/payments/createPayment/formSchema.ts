import * as z from "zod"

export const formShema = z.object({
  category: z.string().nonempty("Category can not be empty"),
  date: z.coerce.date({
    error: (iss) => {
      if (iss.code === "invalid_type") {
        return "Date can not be empty"
      }
      return "Date is invalid"
    },
  }),
  note: z.string().nonempty("Note can not be empty"),
  amount: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return undefined
      return Number(val)
    },
    z
      .number({
        error: (iss) => {
          if (
            iss.input === undefined ||
            iss.input === null ||
            iss.input === ""
          ) {
            return "Amount can not be empty"
          }
          if (typeof iss.input !== "number" || Number.isNaN(iss.input)) {
            return "Amount must be a number"
          }
          return "Amount is invalid"
        },
      })
      .int("Amount must be an integer")
      .nonnegative("Amount must be a non-negative integer"),
  ),
})

export type FormSchema = z.infer<typeof formShema>
export type FormError = z.ZodError<FormSchema>

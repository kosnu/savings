import * as z from "zod"

export const formShema = z.object({
  category: z.string().nonempty("Category can not be empty"),
  date: z.date({
    error: (iss) => {
      if (iss.input === undefined || iss.input === null || iss.input === "") {
        return "Date can not be empty"
      }
      return "Date is invalid"
    },
  }),
  note: z.string().nonempty("Note can not be empty"),
  amount: z
    .number({
      error: (iss) => {
        if (iss.input === undefined || iss.input === null || iss.input === "") {
          return "Amount can not be empty"
        }
        if (typeof iss.input !== "number" || Number.isNaN(iss.input)) {
          return "Amount must be a number"
        }
        return "Amount is invalid"
      },
    })
    .int("Amount must be an integer")
    .nonnegative("Amount must be a non-negative integer")
    .optional(),
})

export const submitFormShema = formShema.extend({
  amount: z
    .number({
      error: (iss) => {
        if (iss.input === undefined || iss.input === null || iss.input === "") {
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
})

export type FormSchema = z.infer<typeof formShema>
export type SubmitFormSchema = z.infer<typeof submitFormShema>
export type FormError = z.core.$ZodFlattenedError<FormSchema>

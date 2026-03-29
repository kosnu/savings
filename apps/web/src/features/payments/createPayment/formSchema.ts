import * as z from "zod"

export const categoryFieldSchema = z.string()

export const dateFieldSchema = z.date({
  error: (iss) => {
    if (iss.input === undefined || iss.input === null || iss.input === "") {
      return "Date can not be empty"
    }
    return "Date is invalid"
  },
})

export const noteFieldSchema = z.string()

export const amountFieldSchema = z
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

const baseSchema = z.object({
  category: categoryFieldSchema,
  date: dateFieldSchema,
  note: noteFieldSchema,
  amount: amountFieldSchema,
})

export const formSchema = baseSchema.partial({
  date: true,
  amount: true,
})
export const submitFormSchema = baseSchema.required({
  date: true,
  amount: true,
})

export type FormSchema = z.infer<typeof formSchema>
export type SubmitFormSchema = z.infer<typeof submitFormSchema>
export type FormError = z.core.$ZodFlattenedError<FormSchema>

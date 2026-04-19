import * as z from "zod"

export const targetMonthFieldSchema = z.date({
  error: (iss) => {
    if (iss.input === undefined || iss.input === null || iss.input === "") {
      return "Month cannot be empty"
    }
    return "Month is invalid"
  },
})

export const monthlyBudgetAmountFieldSchema = z
  .number({
    error: (iss) => {
      if (iss.input === undefined || iss.input === null || iss.input === "") {
        return "Amount cannot be empty"
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
  targetMonth: targetMonthFieldSchema,
  amount: monthlyBudgetAmountFieldSchema,
})

export const monthlyBudgetFormSchema = baseSchema.partial()

export const monthlyBudgetFormSubmitSchema = baseSchema.required({
  targetMonth: true,
  amount: true,
})

export type MonthlyBudgetFormValues = z.infer<typeof monthlyBudgetFormSchema>
export type MonthlyBudgetFormSubmitValues = z.infer<typeof monthlyBudgetFormSubmitSchema>

import * as z from "zod"

import { amountFieldSchema } from "../../../domain/amount"

export const targetMonthFieldSchema = z.date({
  error: (iss) => {
    if (iss.input === undefined || iss.input === null || iss.input === "") {
      return "Month cannot be empty"
    }
    return "Month is invalid"
  },
})

const baseSchema = z.object({
  targetMonth: targetMonthFieldSchema,
  amount: amountFieldSchema,
})

export const monthlyBudgetFormSchema = baseSchema.partial()

export const monthlyBudgetFormSubmitSchema = baseSchema.required({
  targetMonth: true,
  amount: true,
})

export interface MonthlyBudgetFormValues {
  targetMonth?: Date
  amount?: string | number
}

export type MonthlyBudgetFormSubmitValues = z.infer<typeof monthlyBudgetFormSubmitSchema>

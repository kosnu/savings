import * as z from "zod"

import { amountFieldSchema } from "../../../domain/amount"
import { toMonthStartDate } from "../../../domain/date"

const PAST_MONTH_MESSAGE = "Month cannot be before the current month."

export const targetMonthFieldSchema = z
  .date({
    error: (iss) => {
      if (iss.input === undefined || iss.input === null || iss.input === "") {
        return "Month cannot be empty"
      }
      return "Month is invalid"
    },
  })
  .refine((value) => toMonthStartDate(value) >= toMonthStartDate(new Date()), {
    message: PAST_MONTH_MESSAGE,
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

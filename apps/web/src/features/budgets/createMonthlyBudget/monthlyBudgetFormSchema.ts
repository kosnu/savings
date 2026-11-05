import * as z from "zod"

import { amountFieldSchema } from "../../../domain/amount"
import { isSupportedDate, MAX_YEAR, MIN_YEAR } from "../../../domain/date"

// 現在月以降かの判定は、信頼できる時刻を持つDBの認可境界に委ねる。
export const targetMonthFieldSchema = z
  .date({
    error: (iss) => {
      if (iss.input === undefined || iss.input === null || iss.input === "") {
        return "Month cannot be empty"
      }
      return "Month is invalid"
    },
  })
  .refine(isSupportedDate, { error: `Month must be between ${MIN_YEAR} and ${MAX_YEAR}` })

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

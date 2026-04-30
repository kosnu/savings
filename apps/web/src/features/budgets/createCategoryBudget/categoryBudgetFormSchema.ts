import * as z from "zod"

import {
  monthlyBudgetAmountFieldSchema,
  targetMonthFieldSchema,
} from "../createMonthlyBudget/monthlyBudgetFormSchema"

export const categoryBudgetCategoryFieldSchema = z
  .string({
    error: (iss) => {
      if (iss.input === undefined || iss.input === null || iss.input === "") {
        return "Category cannot be empty"
      }
      return "Category is invalid"
    },
  })
  .superRefine((value, context) => {
    if (value === "") {
      context.addIssue({
        code: "custom",
        message: "Category cannot be empty",
      })
      return
    }

    if (!/^\d+$/.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Category is invalid",
      })
    }
  })

const baseSchema = z.object({
  categoryId: categoryBudgetCategoryFieldSchema,
  targetMonth: targetMonthFieldSchema,
  amount: monthlyBudgetAmountFieldSchema,
})

export const categoryBudgetFormSchema = baseSchema.partial()

export const categoryBudgetFormSubmitSchema = baseSchema.required({
  categoryId: true,
  targetMonth: true,
  amount: true,
})

export type CategoryBudgetFormValues = z.infer<typeof categoryBudgetFormSchema>
export type CategoryBudgetFormSubmitValues = z.infer<typeof categoryBudgetFormSubmitSchema>

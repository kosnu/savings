import { format } from "date-fns"

import type { CategoryCreateValues } from "./categoryCreateSchema"

export interface CategoryCreateInput {
  name: string
  budget?: {
    targetMonth: Date
    amount: number
  }
}

export interface CategoryCreateRpcArgs {
  p_category_name: string
  p_budget_effective_from?: string
  p_budget_amount?: number
}

function toMonthStartDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function mapCategoryCreateValuesToCategoryCreateInput(
  value: CategoryCreateValues,
): CategoryCreateInput {
  if (value.budgetAmount !== undefined) {
    return {
      name: value.name,
      budget: {
        targetMonth: toMonthStartDate(new Date()),
        amount: value.budgetAmount,
      },
    }
  }

  return {
    name: value.name,
  }
}

export function toCategoryCreateRpcArgs(value: CategoryCreateInput): CategoryCreateRpcArgs {
  const args: CategoryCreateRpcArgs = {
    p_category_name: value.name,
  }

  if (value.budget) {
    args.p_budget_effective_from = format(toMonthStartDate(value.budget.targetMonth), "yyyy-MM-dd")
    args.p_budget_amount = value.budget.amount
  }

  return args
}

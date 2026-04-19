import type { MonthlyBudgetWriteInput } from "./monthlyBudgetFormMappers"
import type {
  MonthlyBudgetFormSubmitValues,
  MonthlyBudgetFormValues,
} from "./monthlyBudgetFormSchema"

export function createMonthlyBudgetDefaultValues(): MonthlyBudgetFormValues {
  return {
    targetMonth: undefined,
    amount: undefined,
  }
}

export function mapSubmitFormValuesToMonthlyBudgetWriteInput(
  value: MonthlyBudgetFormSubmitValues,
): MonthlyBudgetWriteInput {
  return {
    targetMonth: value.targetMonth,
    amount: value.amount,
  }
}

import type { CategoryBudgetWriteInput } from "./categoryBudgetFormMappers"
import type {
  CategoryBudgetFormSubmitValues,
  CategoryBudgetFormValues,
} from "./categoryBudgetFormSchema"

export function createCategoryBudgetDefaultValues(): CategoryBudgetFormValues {
  return {
    categoryId: "",
    targetMonth: undefined,
    amount: undefined,
  }
}

export function mapSubmitFormValuesToCategoryBudgetWriteInput(
  value: CategoryBudgetFormSubmitValues,
): CategoryBudgetWriteInput {
  return {
    categoryId: Number.parseInt(value.categoryId, 10),
    targetMonth: value.targetMonth,
    amount: value.amount,
  }
}

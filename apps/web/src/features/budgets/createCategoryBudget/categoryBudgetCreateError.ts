import { isPostgresUniqueViolationError } from "../../../utils/postgresError"

const DUPLICATE_CATEGORY_BUDGET_MESSAGE =
  "A category budget for this category and month already exists."
const GENERIC_CREATE_CATEGORY_BUDGET_MESSAGE = "Failed to create category budget."

export function toCategoryBudgetCreateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_CATEGORY_BUDGET_MESSAGE
  }

  return GENERIC_CREATE_CATEGORY_BUDGET_MESSAGE
}

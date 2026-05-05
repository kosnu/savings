import { isPostgresUniqueViolationError } from "../../../utils/postgresError"

const DUPLICATE_MONTHLY_BUDGET_MESSAGE = "A monthly budget for this month already exists."
const GENERIC_CREATE_MONTHLY_BUDGET_MESSAGE = "Failed to create monthly budget."

export function toMonthlyBudgetCreateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_MONTHLY_BUDGET_MESSAGE
  }

  return GENERIC_CREATE_MONTHLY_BUDGET_MESSAGE
}

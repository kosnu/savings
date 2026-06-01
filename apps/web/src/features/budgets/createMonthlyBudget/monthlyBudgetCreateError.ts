import { isPostgresUniqueViolationError } from "../../../utils/postgresError"

const DUPLICATE_MONTHLY_BUDGET_MESSAGE = "A monthly budget for this month already exists."
const PAST_MONTHLY_BUDGET_MESSAGE = "Month cannot be before the current month."
const GENERIC_CREATE_MONTHLY_BUDGET_MESSAGE = "Failed to create monthly budget."

export function toMonthlyBudgetCreateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_MONTHLY_BUDGET_MESSAGE
  }

  if (isPastMonthlyBudgetError(error)) {
    return PAST_MONTHLY_BUDGET_MESSAGE
  }

  return GENERIC_CREATE_MONTHLY_BUDGET_MESSAGE
}

function isPastMonthlyBudgetError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error.message === PAST_MONTHLY_BUDGET_MESSAGE
  )
}

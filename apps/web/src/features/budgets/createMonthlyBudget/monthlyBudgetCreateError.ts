// PostgreSQL SQLSTATE 23505 means unique_violation.
export const POSTGRES_UNIQUE_VIOLATION_CODE = "23505"

const DUPLICATE_MONTHLY_BUDGET_MESSAGE = "A monthly budget for this month already exists."
const GENERIC_CREATE_MONTHLY_BUDGET_MESSAGE = "Failed to create monthly budget."

export function toMonthlyBudgetCreateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_MONTHLY_BUDGET_MESSAGE
  }

  return GENERIC_CREATE_MONTHLY_BUDGET_MESSAGE
}

function isPostgresUniqueViolationError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false
  }

  return error.code === POSTGRES_UNIQUE_VIOLATION_CODE
}

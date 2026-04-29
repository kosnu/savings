// PostgreSQL SQLSTATE 23505 means unique_violation.
export const POSTGRES_UNIQUE_VIOLATION_CODE = "23505"

const DUPLICATE_CATEGORY_BUDGET_MESSAGE =
  "A category budget for this category and month already exists."
const GENERIC_CREATE_CATEGORY_BUDGET_MESSAGE = "Failed to create category budget."

export function toCategoryBudgetCreateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_CATEGORY_BUDGET_MESSAGE
  }

  return GENERIC_CREATE_CATEGORY_BUDGET_MESSAGE
}

function isPostgresUniqueViolationError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false
  }

  return error.code === POSTGRES_UNIQUE_VIOLATION_CODE
}

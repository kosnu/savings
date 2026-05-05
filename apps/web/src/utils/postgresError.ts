// PostgreSQL SQLSTATE 23505 means unique_violation.
export const POSTGRES_UNIQUE_VIOLATION_CODE = "23505"

export function isPostgresUniqueViolationError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false
  }

  return error.code === POSTGRES_UNIQUE_VIOLATION_CODE
}

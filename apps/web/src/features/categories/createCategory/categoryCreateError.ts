import { isPostgresUniqueViolationError } from "../../../utils/postgresError"

const DUPLICATE_CATEGORY_NAME_MESSAGE = "A category with this name already exists."
const GENERIC_CREATE_CATEGORY_MESSAGE = "Failed to create category."

export function toCategoryCreateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_CATEGORY_NAME_MESSAGE
  }

  return GENERIC_CREATE_CATEGORY_MESSAGE
}

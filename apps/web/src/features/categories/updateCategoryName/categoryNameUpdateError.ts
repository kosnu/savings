import { isPostgresUniqueViolationError } from "../../../utils/postgresError"

const DUPLICATE_CATEGORY_NAME_MESSAGE = "A category with this name already exists."
const GENERIC_UPDATE_CATEGORY_NAME_MESSAGE = "Failed to save category."

export function toCategoryNameUpdateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_CATEGORY_NAME_MESSAGE
  }

  return GENERIC_UPDATE_CATEGORY_NAME_MESSAGE
}

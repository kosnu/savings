import { isPostgresUniqueViolationError } from "../../../utils/postgresError"

const DUPLICATE_CATEGORY_NAME_MESSAGE = "A category with this name already exists."
const GENERIC_UPDATE_CATEGORY_MESSAGE = "Failed to update category."

export function toCategoryUpdateErrorMessage(error: unknown): string {
  if (isPostgresUniqueViolationError(error)) {
    return DUPLICATE_CATEGORY_NAME_MESSAGE
  }

  return GENERIC_UPDATE_CATEGORY_MESSAGE
}

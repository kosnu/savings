import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type Note = {
  value: Readonly<string | null>
}

const maxLength = 200

export function createNote(
  value: string | null,
): Result<Note, DomainError> {
  if (value === null) {
    return ok({ value })
  }

  if (value.length > maxLength) {
    return err(
      validationError(
        `Note must be a non-empty string with a maximum length of ${maxLength} characters`,
        { value },
      ),
    )
  }

  return ok({ value })
}

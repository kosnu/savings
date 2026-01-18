import { err, ok, Result } from "../../shared/result.ts"
import { type DomainError, validationError } from "../../shared/errors.ts"

export type Note = {
  value: Readonly<string>
}

const maxLength = 200

export function createNote(
  value: string,
): Result<Note, DomainError> {
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

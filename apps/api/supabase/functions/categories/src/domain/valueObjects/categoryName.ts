import { DomainError, validationError } from "../../shared/errors.ts"
import { err, ok, Result } from "../../shared/result.ts"

export type CategoryName = {
  value: Readonly<string>
}

export function createCategoryName(
  value: string,
): Result<CategoryName, DomainError> {
  // ここでは簡単なトリム処理のみを行い、詳細なバリデーションはドメインサービスやユースケース層で行う
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return err(validationError("CategoryName cannot be empty"))
  }

  return ok({ value: trimmedValue })
}

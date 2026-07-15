import type { TFunction } from "i18next"

const interpolationByMessageKey: Record<string, Record<string, number>> = {
  "validation.note.max": { max: 30 },
  "validation.categoryName.max": { max: 20 },
  "categories.pinLimit": { count: 3 },
}

const messageKeyByText: Record<string, string> = {
  "Amount cannot be empty": "validation.amount.empty",
  "Amount must be a number": "validation.amount.number",
  "Amount is invalid": "validation.amount.invalid",
  "Amount must be an integer": "validation.amount.integer",
  "Amount must be a non-negative integer": "validation.amount.nonnegative",
  "Date cannot be empty": "validation.date.empty",
  "Date is invalid": "validation.date.invalid",
  "Note must be 30 characters or less": "validation.note.max",
  "Month cannot be empty": "validation.month.empty",
  "Month is invalid": "validation.month.invalid",
  "Month cannot be before the current month.": "validation.month.past",
  "Category name cannot be empty": "validation.categoryName.empty",
  "Category name must be 20 characters or less": "validation.categoryName.max",
  "Display name cannot be empty": "validation.displayName.empty",
  "A category with this name already exists.": "categories.duplicateName",
  "Failed to create category.": "categories.createFailed",
  "Failed to save category.": "categories.updateFailed",
  "You can pin up to 3 categories.": "categories.pinLimit",
  "A monthly budget for this month already exists.": "budgets.duplicate",
  "Failed to create monthly budget.": "budgets.createFailed",
  "Failed to update monthly budget.": "budgets.updateFailed",
  "Failed to remove monthly budget.": "budgets.removeFailed",
}

export function translateMessage(t: TFunction, message: string): string {
  const key = messageKeyByText[message] ?? message

  if (!t(`${key}`, { defaultValue: "" })) {
    return message
  }

  return t(key, interpolationByMessageKey[key] ?? {})
}

import type { Category } from "../../../types/category"
import type { Payment } from "../../../types/payment"
import { unknownCategory } from "../../categories/unknownCategory"

/**
 * 支払い配列をカテゴリごとの合計にマップする
 * 未カテゴリは opts.defaultCategory（既定は "Unknown category"）に集約する
 */
function mapPaymentsToCategory(
  payments: Payment[],
  categories: Category[],
): Record<string, number> {
  // Initialize map with all categories set to 0 so every category is present in the result
  const categoryMap: Record<string, number> = {}
  for (const c of categories) {
    categoryMap[c.name] = 0
  }

  // Ensure default 'Unknown category' key exists if there are payments without a matching category
  if (!(unknownCategory.name in categoryMap)) {
    categoryMap[unknownCategory.name] = 0
  }

  // Aggregate payments into the initialized map
  for (const payment of payments) {
    const category = categories.find((c) => c.id === payment.categoryId)
    const categoryName = category ? category.name : unknownCategory.name
    const amount = Number(payment.amount) || 0
    categoryMap[categoryName] = (categoryMap[categoryName] || 0) + amount
  }

  return categoryMap
}

export { mapPaymentsToCategory }

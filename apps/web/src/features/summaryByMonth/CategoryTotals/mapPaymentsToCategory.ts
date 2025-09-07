import type { Category } from "../../../types/category"
import type { Payment } from "../../../types/payment"

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
  const DEFAULT_UNCATEGORIZED = "Unknown category"
  if (!(DEFAULT_UNCATEGORIZED in categoryMap)) {
    categoryMap[DEFAULT_UNCATEGORIZED] = 0
  }

  // Aggregate payments into the initialized map
  for (const payment of payments) {
    const category = categories.find((c) => c.id === payment.categoryId)
    const categoryName = category ? category.name : DEFAULT_UNCATEGORIZED
    const amount = Number(payment.amount) || 0
    categoryMap[categoryName] = (categoryMap[categoryName] || 0) + amount
  }

  return categoryMap
}

export { mapPaymentsToCategory }

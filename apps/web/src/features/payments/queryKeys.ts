import type { PaymentId } from "../../types/payment"

export const paymentQueryKeys = {
  all: ["payments"],
  list: (cacheScope: string, dateKey: string, categoryId: number | null | undefined) =>
    ["payments", cacheScope, dateKey, getCategoryQueryKey(categoryId)] as const,
  detailsAll: ["paymentDetails"],
  details: (paymentId: PaymentId | null) => ["paymentDetails", paymentId] as const,
} as const

function getCategoryQueryKey(categoryId: number | null | undefined): string {
  if (categoryId === undefined) return "all-categories"
  if (categoryId === null) return "uncategorized"
  return `category-${categoryId}`
}

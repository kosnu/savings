import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE } from "./paymentsSearchSchema"

export function toPaymentCategoryId(categorySearch?: string): number | null | undefined {
  if (categorySearch === PAYMENT_SEARCH_CATEGORY_NONE_VALUE) {
    return null
  }
  if (categorySearch === undefined) {
    return undefined
  }

  const categoryId = Number(categorySearch)

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return undefined
  }

  return categoryId
}

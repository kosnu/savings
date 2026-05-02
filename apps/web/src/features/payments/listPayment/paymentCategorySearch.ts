import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE } from "./paymentsSearchSchema"

export function toPaymentCategorySearch(categorySearch?: string | null): string | undefined {
  if (categorySearch === PAYMENT_SEARCH_CATEGORY_NONE_VALUE) {
    return PAYMENT_SEARCH_CATEGORY_NONE_VALUE
  }

  if (categorySearch === undefined || categorySearch === null || categorySearch === "") {
    return undefined
  }

  const categoryId = Number(categorySearch)

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return undefined
  }

  return String(categoryId)
}

export function toPaymentCategoryId(categorySearch?: string): number | null | undefined {
  const normalizedCategorySearch = toPaymentCategorySearch(categorySearch)

  if (normalizedCategorySearch === PAYMENT_SEARCH_CATEGORY_NONE_VALUE) {
    return null
  }
  if (normalizedCategorySearch === undefined) {
    return undefined
  }

  return Number(normalizedCategorySearch)
}

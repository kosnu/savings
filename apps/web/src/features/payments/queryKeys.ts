import type { PaymentId } from "../../types/payment"

export const paymentQueryKeys = {
  all: ["payments"] as const,
  book: (bookId: number) => ["payments", bookId] as const,
  list: (
    bookId: number,
    cacheScope: string,
    dateKey: string,
    categoryId: number | null | undefined,
  ) =>
    [
      ...paymentQueryKeys.book(bookId),
      "list",
      cacheScope,
      dateKey,
      getCategoryQueryKey(categoryId),
    ] as const,
  frequent: (bookId: number, startDate: string, endDate: string) =>
    [...paymentQueryKeys.book(bookId), "frequent", startDate, endDate] as const,
  detailsAll: ["paymentDetails"] as const,
  detailsBook: (bookId: number) => ["paymentDetails", bookId] as const,
  details: (bookId: number, paymentId: PaymentId | null) =>
    [...paymentQueryKeys.detailsBook(bookId), paymentId] as const,
} as const

function getCategoryQueryKey(categoryId: number | null | undefined): string {
  if (categoryId === undefined) return "all-categories"
  if (categoryId === null) return "uncategorized"
  return `category-${categoryId}`
}

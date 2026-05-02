import { useLocation } from "@tanstack/react-router"

import { toPaymentCategoryId } from "./paymentCategorySearch"

export function useCategoryId(): number | null | undefined {
  const categorySearch = useLocation({
    select: (location) => location.search.category,
  })

  return toPaymentCategoryId(categorySearch)
}

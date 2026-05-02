import { Select } from "@radix-ui/themes"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { memo, Suspense, use, useCallback } from "react"
import { ErrorBoundary } from "react-error-boundary"

import {
  CategoryOption,
  ErrorCategoryOption,
  LoadingCategoryOption,
} from "../../../categories/components/CategorySelect"
import { useCategories } from "../../../categories/listCategory/useCategories"
import { toPaymentCategoryId, toPaymentCategorySearch } from "../paymentCategorySearch"
import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE } from "../paymentsSearchSchema"

const PAYMENT_SEARCH_CATEGORY_ALL_VALUE = "all"

export const PaymentCategoryFilter = memo(function PaymentCategoryFilter() {
  const categorySearch = useLocation({
    select: (location) => location.search.category,
  })
  const navigate = useNavigate({ from: "/payments" })
  const { promise: categoriesPromise } = useCategories()
  const value = toPaymentCategoryFilterValue(categorySearch)

  const handleChange = useCallback(
    (nextValue: string) => {
      const categorySearch =
        nextValue === PAYMENT_SEARCH_CATEGORY_ALL_VALUE
          ? undefined
          : toPaymentCategorySearch(nextValue)

      void navigate({
        to: "/payments",
        search: (prev) => ({ ...prev, category: categorySearch }),
      })
    },
    [navigate],
  )

  return (
    <Select.Root name="category-filter" value={value} onValueChange={handleChange}>
      <Select.Trigger aria-label="Category filter" style={{ width: "100%" }} />
      <Select.Content>
        <Select.Item value={PAYMENT_SEARCH_CATEGORY_ALL_VALUE}>All categories</Select.Item>
        <Select.Item value={PAYMENT_SEARCH_CATEGORY_NONE_VALUE}>Uncategorized</Select.Item>
        <ErrorBoundary fallback={<ErrorCategoryOption />}>
          <Suspense fallback={<LoadingCategoryOption />}>
            <PaymentCategoryOptions categoriesPromise={categoriesPromise} />
          </Suspense>
        </ErrorBoundary>
      </Select.Content>
    </Select.Root>
  )
})

interface PaymentCategoryOptionsProps {
  categoriesPromise: ReturnType<typeof useCategories>["promise"]
}

const PaymentCategoryOptions = memo(function PaymentCategoryOptions({
  categoriesPromise,
}: PaymentCategoryOptionsProps) {
  const categories = use(categoriesPromise)

  return (
    <>
      {categories.map((category) => (
        <CategoryOption key={category.id} category={category} />
      ))}
    </>
  )
})

function toPaymentCategoryFilterValue(categorySearch?: string): string {
  const categoryId = toPaymentCategoryId(categorySearch)

  if (categoryId === undefined) {
    return PAYMENT_SEARCH_CATEGORY_ALL_VALUE
  }
  if (categoryId === null) {
    return PAYMENT_SEARCH_CATEGORY_NONE_VALUE
  }

  return String(categoryId)
}

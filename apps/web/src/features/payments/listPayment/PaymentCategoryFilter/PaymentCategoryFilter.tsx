import { Select } from "@radix-ui/themes"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { memo, Suspense, use, useCallback } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { CategoryOption, ErrorCategoryOption } from "../../../categories/components/CategorySelect"
import { useCategories } from "../../../categories/listCategory/useCategories"
import { toPaymentCategoryId, toPaymentCategorySearch } from "../paymentCategorySearch"
import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE } from "../paymentsSearchSchema"

const PAYMENT_SEARCH_CATEGORY_ALL_VALUE = "all"
const PAYMENT_SEARCH_CATEGORY_UNKNOWN_LABEL = "Unknown category"

export const PaymentCategoryFilter = memo(function PaymentCategoryFilter() {
  const categorySearch = useLocation({
    select: (location) => location.search.category,
  })
  const navigate = useNavigate({ from: "/payments" })
  const { promise: categoriesPromise } = useCategories()
  const categoryId = toPaymentCategoryId(categorySearch)
  const value = toPaymentCategoryFilterValue(categorySearch)
  const selectedCategoryValue = typeof categoryId === "number" ? String(categoryId) : undefined

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
          <Suspense
            fallback={<LoadingSelectedCategoryOption selectedValue={selectedCategoryValue} />}
          >
            <PaymentCategoryOptions
              categoriesPromise={categoriesPromise}
              selectedValue={selectedCategoryValue}
            />
          </Suspense>
        </ErrorBoundary>
      </Select.Content>
    </Select.Root>
  )
})

interface PaymentCategoryOptionsProps {
  categoriesPromise: ReturnType<typeof useCategories>["promise"]
  selectedValue?: string
}

const PaymentCategoryOptions = memo(function PaymentCategoryOptions({
  categoriesPromise,
  selectedValue,
}: PaymentCategoryOptionsProps) {
  const categories = use(categoriesPromise)
  const hasSelectedCategory =
    selectedValue === undefined ||
    categories.some((category) => String(category.id) === selectedValue)

  return (
    <>
      {!hasSelectedCategory && <UnknownCategoryOption value={selectedValue} />}
      {categories.map((category) => (
        <CategoryOption key={category.id} category={category} />
      ))}
    </>
  )
})

function LoadingSelectedCategoryOption({ selectedValue }: { selectedValue?: string }) {
  return (
    <Select.Item disabled value={selectedValue ?? "loading"}>
      Loading
    </Select.Item>
  )
}

function UnknownCategoryOption({ value }: { value: string }) {
  return (
    <Select.Item disabled value={value}>
      {PAYMENT_SEARCH_CATEGORY_UNKNOWN_LABEL}
    </Select.Item>
  )
}

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

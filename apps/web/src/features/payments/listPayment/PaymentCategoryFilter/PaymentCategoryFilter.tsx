import { Select } from "@radix-ui/themes"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { memo, Suspense, use, useCallback } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { CategoryOption, ErrorCategoryOption, useCategories } from "../../../categories"
import { toPaymentCategoryId, toPaymentCategorySearch } from "../paymentCategorySearch"
import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE } from "../paymentsSearchSchema"

import styles from "./PaymentCategoryFilter.module.css"

const PAYMENT_SEARCH_CATEGORY_ALL_VALUE = "all"

export const PaymentCategoryFilter = memo(function PaymentCategoryFilter() {
  const { t } = useTranslation()
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
      <Select.Trigger
        aria-label={t("payments.category.filter")}
        className={categoryId === null ? styles.systemLabel : undefined}
        style={{ width: "100%" }}
      />
      <Select.Content>
        <Select.Item value={PAYMENT_SEARCH_CATEGORY_ALL_VALUE}>
          {t("payments.category.all")}
        </Select.Item>
        <Select.Item className={styles.systemLabel} value={PAYMENT_SEARCH_CATEGORY_NONE_VALUE}>
          {t("payments.category.uncategorized")}
        </Select.Item>
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
  const { t } = useTranslation()

  return (
    <Select.Item disabled value={selectedValue ?? "loading"}>
      {t("payments.category.loading")}
    </Select.Item>
  )
}

function UnknownCategoryOption({ value }: { value: string }) {
  const { t } = useTranslation()

  return (
    <Select.Item disabled value={value}>
      {t("payments.category.unknown")}
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

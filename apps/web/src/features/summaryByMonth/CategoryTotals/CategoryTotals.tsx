import { Box, Button, Flex, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { i18next } from "../../../i18n"
import { toCurrency } from "../../../utils/toCurrency"
import { BudgetProgress } from "../../budgets"
import type { CategoryTotals as CategoryTotalsData } from "./fetchCategoryTotals"
import { useCategoryTotals } from "./useCategoryTotals"

import styles from "./CategoryTotals.module.css"

const initialVisibleCount = 3

interface CategoryTotalsProps {
  cacheScope?: string
}

export function CategoryTotals({ cacheScope }: CategoryTotalsProps) {
  const { promise, targetMonthKey } = useCategoryTotals({ cacheScope })
  const { t } = useTranslation()

  return (
    <ErrorBoundary
      fallback={<Text color="red">{t("common.failed")}</Text>}
      resetKeys={[cacheScope ?? "default", targetMonthKey]}
    >
      <Suspense fallback={<CategoryTotalsLoading />}>
        <CategoryTotalsResolved promise={promise} targetMonthKey={targetMonthKey} />
      </Suspense>
    </ErrorBoundary>
  )
}

function CategoryTotalsResolved({
  promise,
  targetMonthKey,
}: {
  promise: Promise<CategoryTotalsData>
  targetMonthKey: string
}) {
  const categoryTotals = use(promise)

  if (categoryTotals.length === 0) {
    return null
  }

  const categoryTotalsKey = [
    targetMonthKey,
    ...categoryTotals.map(
      (total) =>
        `${total.key}:${total.kind}:${total.totalAmount}:${total.budgetStatus}:${total.budgetAmount ?? "none"}:${total.pinned ? "1" : "0"}`,
    ),
  ].join(":")

  return <CategoryTotalsContent key={categoryTotalsKey} categoryTotals={categoryTotals} />
}

function CategoryTotalsLoading() {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("summary.loadingCategoryTotals")} direction="column" gap="3" width="100%">
      {["primary", "secondary", "tertiary"].map((row) => (
        <Flex key={row} direction="column" gap="1" width="100%">
          <Flex justify="between" gap="2" width="100%">
            <Skeleton loading>
              <Text aria-hidden>{t("summary.category")}</Text>
            </Skeleton>
            <Skeleton loading>
              <Text aria-hidden>¥0,000</Text>
            </Skeleton>
          </Flex>
          <Skeleton loading width="100%">
            <Text aria-hidden>　　　　</Text>
          </Skeleton>
          <Flex justify="end" width="100%">
            <Skeleton loading>
              <Text aria-hidden>¥0,000 left</Text>
            </Skeleton>
          </Flex>
        </Flex>
      ))}
    </Flex>
  )
}

interface CategoryTotalsContentProps {
  categoryTotals: CategoryTotalsData
}

function CategoryTotalsContent({ categoryTotals }: CategoryTotalsContentProps) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount)
  const { t } = useTranslation()

  const hasOverflow = categoryTotals.length > initialVisibleCount
  const isExpanded = visibleCount >= categoryTotals.length
  const visibleTotals = categoryTotals.slice(0, visibleCount)
  const toggleLabel = isExpanded ? t("summary.showLess") : t("summary.showMore")
  const toggleAriaLabel = isExpanded ? t("summary.showLessAria") : t("summary.showMoreAria")

  return (
    <Flex direction="column" gap="3" width="100%">
      <Flex direction="column" gap="2" width="100%">
        {visibleTotals.map((total) => (
          <Flex key={total.key} direction="column" gap="1" width="100%">
            <Flex align="center" justify="between" gap="2" width="100%">
              <Box flexGrow="1" minWidth="0">
                <CategoryTotalName total={total} />
              </Box>
              <CategoryTotalAmount amount={total.totalAmount} />
            </Flex>
            <CategoryBudgetProgress total={total} />
            <Flex justify="end" width="100%">
              <CategoryBudgetDifference total={total} />
            </Flex>
          </Flex>
        ))}
      </Flex>
      {hasOverflow && (
        <Flex justify="center">
          <Button
            type="button"
            variant="ghost"
            color="gray"
            size="2"
            aria-label={toggleAriaLabel}
            onClick={() =>
              setVisibleCount(isExpanded ? initialVisibleCount : categoryTotals.length)
            }
          >
            {toggleLabel}
          </Button>
        </Flex>
      )}
    </Flex>
  )
}

function CategoryBudgetProgress({ total }: { total: CategoryTotalsData[number] }) {
  const { t } = useTranslation()

  if (total.budgetStatus !== "amount" || total.budgetAmount === null) {
    return null
  }

  const categoryName =
    total.kind === "uncategorized" ? t("payments.category.uncategorized") : total.categoryName
  const difference = formatBudgetDifference(total)

  return (
    <BudgetProgress
      amount={total.totalAmount}
      ariaLabel={t("summary.categoryBudgetProgress", { category: categoryName })}
      ariaValueText={t("summary.budgetProgressValue", {
        amount: toCurrency(total.totalAmount),
        budget: toCurrency(total.budgetAmount),
        difference,
      })}
      budget={total.budgetAmount}
      status={total.budgetDifference !== null && total.budgetDifference < 0 ? "over" : "remaining"}
    />
  )
}

function CategoryTotalName({ total }: { total: CategoryTotalsData[number] }) {
  const { t } = useTranslation()
  const categoryName =
    total.kind === "uncategorized" ? t("payments.category.uncategorized") : total.categoryName

  return (
    <Flex align="center" gap="2">
      <Text className={total.kind === "uncategorized" ? styles.systemLabel : undefined}>
        {categoryName}
      </Text>
    </Flex>
  )
}

function CategoryTotalAmount({ amount }: { amount: number }) {
  return (
    <Text align="right" className={styles.amount}>
      {toCurrency(amount)}
    </Text>
  )
}

function CategoryBudgetDifference({ total }: { total: CategoryTotalsData[number] }) {
  const text = formatBudgetDifference(total)

  const color = getBudgetDifferenceColor(total)

  return (
    <Text align="right" className={styles.difference} color={color} size="1">
      {text}
    </Text>
  )
}

function formatBudgetDifference(total: CategoryTotalsData[number]): string {
  if (total.budgetStatus === "none") {
    return i18next.t("common.noBudget")
  }

  if (total.budgetStatus === "unset") {
    return i18next.t("common.notSet")
  }

  const difference = total.budgetDifference

  if (difference === null) {
    return i18next.t("common.failed")
  }

  if (difference > 0) {
    return i18next.t("common.left", { amount: toCurrency(difference) })
  }

  if (difference < 0) {
    return i18next.t("common.over", { amount: toCurrency(Math.abs(difference)) })
  }

  return i18next.t("common.onBudget")
}

function getBudgetDifferenceColor(
  total: CategoryTotalsData[number],
): "gray" | "green" | "yellow" | "red" {
  if (total.budgetStatus === "none" || total.budgetStatus === "unset") {
    return "gray"
  }

  if (total.budgetDifference === null) {
    return "red"
  }

  if (total.budgetDifference > 0) {
    return "green"
  }

  if (total.budgetDifference < 0) {
    return "yellow"
  }

  return "gray"
}

import { Flex, Link as ThemeLink, Skeleton, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { memo, Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { formatTargetMonthKey, toTargetMonth } from "../../../../domain/date"
import { toCurrency } from "../../../../utils/toCurrency"
import { useEffectiveMonthlyBudget } from "../../getMonthlyBudget/useEffectiveMonthlyBudget"
import {
  getMonthlyBudgetUsageDisplay,
  type MonthlyBudgetUsageStatus,
} from "../../utils/monthlyBudgetUsage"
import { BudgetProgress } from "../BudgetProgress"

export interface MonthlyBudgetUsageProps {
  targetDate: Date | null
  totalExpenditures: number | null
  totalExpendituresError: Error | null
  totalExpendituresLoading: boolean
}

export function MonthlyBudgetUsage({
  targetDate,
  totalExpenditures,
  totalExpendituresError,
  totalExpendituresLoading,
}: MonthlyBudgetUsageProps) {
  if (totalExpendituresLoading) {
    return <MonthlyBudgetUsageText loading />
  }

  if (totalExpendituresError || targetDate === null) {
    return null
  }

  if (totalExpenditures === null) {
    return <SpendingAmount amount={null} />
  }

  const targetMonth = formatTargetMonthKey(toTargetMonth(targetDate))

  return (
    <ErrorBoundary
      fallback={
        <Flex direction="column" gap="1">
          <MonthlyBudgetUsageText error />
          <SpendingAmount amount={totalExpenditures} />
        </Flex>
      }
      resetKeys={[targetMonth]}
    >
      <Suspense
        fallback={
          <Flex direction="column" gap="1">
            <MonthlyBudgetUsageText loading />
            <SpendingAmount amount={totalExpenditures} />
          </Flex>
        }
      >
        <MonthlyBudgetUsageResolved
          key={targetMonth}
          targetMonth={targetMonth}
          totalExpenditures={totalExpenditures}
        />
      </Suspense>
    </ErrorBoundary>
  )
}

function MonthlyBudgetUsageResolved({
  targetMonth,
  totalExpenditures,
}: {
  targetMonth: string
  totalExpenditures: number
}) {
  const { t } = useTranslation()
  const { data: monthlyBudgetState } = useEffectiveMonthlyBudget(targetMonth)
  const [currentMonth] = useState(() => formatTargetMonthKey(toTargetMonth(new Date())))

  const budgetAmount =
    monthlyBudgetState.status === "amount" ? monthlyBudgetState.monthlyBudget.amount : null
  const isCurrentMonth = targetMonth === currentMonth
  const display = getMonthlyBudgetUsageDisplay(totalExpenditures, budgetAmount)

  const budgetText =
    budgetAmount === null
      ? t(monthlyBudgetState.status === "none" ? "common.noBudget" : "common.notSet")
      : toCurrency(budgetAmount)
  const showSettingsLink = monthlyBudgetState.status === "unset" && isCurrentMonth

  return (
    <Flex direction="column" gap="1" width="100%">
      {display && <MonthlyBudgetUsageText status={display.status} text={display.text} />}
      {display && budgetAmount !== null && (
        <BudgetProgress
          amount={totalExpenditures}
          ariaLabel={t("summary.monthlyBudgetProgress")}
          ariaValueText={t("summary.budgetProgressValue", {
            amount: toCurrency(totalExpenditures),
            budget: toCurrency(budgetAmount),
            difference: display.text,
          })}
          budget={budgetAmount}
          status={display.status}
        />
      )}
      <Flex align="baseline" justify="end" gap="4" wrap="wrap">
        <SpendingAmount amount={totalExpenditures} />
        <Flex align="baseline" gap="1" minWidth="0" wrap="wrap">
          {monthlyBudgetState.status !== "none" && (
            <Text color="gray" size="2">
              {t("summary.monthlyBudget")}
            </Text>
          )}
          <Text
            color={budgetAmount === null ? "gray" : undefined}
            size="3"
            style={{ overflowWrap: "anywhere" }}
          >
            {budgetText}
          </Text>
        </Flex>
      </Flex>
      {showSettingsLink && (
        <Flex justify="end">
          <ThemeLink asChild size="2">
            <Link to="/settings/book">{t("budgets.openSettings")}</Link>
          </ThemeLink>
        </Flex>
      )}
    </Flex>
  )
}

function SpendingAmount({ amount }: { amount: number | null }) {
  const { t } = useTranslation()

  return (
    <Flex align="baseline" gap="1" minWidth="0" wrap="wrap">
      <Text color="gray" size="2">
        {t("payments.total.heading")}
      </Text>
      <Text size="3" style={{ overflowWrap: "anywhere" }}>
        {amount === null ? "-" : toCurrency(amount)}
      </Text>
    </Flex>
  )
}

interface MonthlyBudgetUsageTextProps {
  error?: boolean
  loading?: boolean
  status?: MonthlyBudgetUsageStatus
  text?: string
}

const MonthlyBudgetUsageText = memo(function MonthlyBudgetUsageText({
  error = false,
  loading = false,
  status,
  text,
}: MonthlyBudgetUsageTextProps) {
  const { t } = useTranslation()
  const content = error ? t("common.failed") : (text ?? "\u00A0")
  return (
    <Skeleton
      loading={loading}
      data-testid={loading ? "budget-difference-skeleton" : undefined}
      style={{ maxWidth: "100%" }}
    >
      <Text
        aria-hidden={loading}
        color={getTextColor(error, status)}
        role={error ? "status" : undefined}
        size={status ? "4" : "1"}
        weight={status ? "medium" : undefined}
        style={{
          display: "inline-block",
          maxWidth: "100%",
          minHeight: "20px",
          minWidth: "12ch",
          overflowWrap: "anywhere",
        }}
      >
        {content}
      </Text>
    </Skeleton>
  )
})

function getTextColor(
  error: boolean,
  status?: MonthlyBudgetUsageStatus,
): "green" | "yellow" | "red" | "gray" {
  if (error) {
    return "red"
  }

  if (status === "remaining") {
    return "green"
  }

  if (status === "over") {
    return "yellow"
  }

  return "gray"
}

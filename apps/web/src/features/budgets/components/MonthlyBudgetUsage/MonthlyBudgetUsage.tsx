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

  const showSettingsLink = monthlyBudgetState.status === "unset" && isCurrentMonth

  return (
    <Flex direction="column" gap="1" width="100%">
      <Flex align="baseline" justify="between" gap="1" wrap="wrap">
        <Flex align="baseline" gap="1" wrap="wrap">
          <Text color="gray" size="2">
            {t(
              monthlyBudgetState.status === "none"
                ? "common.noBudget"
                : "summary.monthlyBudgetHeading",
            )}
          </Text>
          {monthlyBudgetState.status === "unset" && (
            <Text color="gray" size="2">
              {t("common.notSet")}
            </Text>
          )}
        </Flex>
        <SpendingAmount amount={totalExpenditures} budget={budgetAmount} />
      </Flex>
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
      {display && <MonthlyBudgetUsageText status={display.status} text={display.text} />}
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

function SpendingAmount({
  amount,
  budget = null,
}: {
  amount: number | null
  budget?: number | null
}) {
  const { t } = useTranslation()

  return (
    <Flex align="baseline" justify="end" gap="1" minWidth="0" ml="auto" wrap="wrap">
      <Text color="gray" size="2">
        {t("payments.total.heading")}
      </Text>
      <Text size="3" align="right" style={{ overflowWrap: "anywhere" }}>
        <span>{amount === null ? "-" : toCurrency(amount)}</span>
        {budget !== null && (
          <>
            {t("summary.budgetAmountSeparator")}
            <span>{toCurrency(budget)}</span>
          </>
        )}
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
        align={status ? "right" : undefined}
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

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

  if (totalExpendituresError || targetDate === null || totalExpenditures === null) {
    return null
  }

  const targetMonth = formatTargetMonthKey(toTargetMonth(targetDate))

  return (
    <ErrorBoundary fallback={<MonthlyBudgetUsageText error />} resetKeys={[targetMonth]}>
      <Suspense fallback={<MonthlyBudgetUsageText loading />}>
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
  const display = getMonthlyBudgetUsageDisplay(totalExpenditures, budgetAmount, isCurrentMonth)

  const budgetText =
    budgetAmount === null
      ? t(monthlyBudgetState.status === "none" ? "common.noBudget" : "common.notSet")
      : toCurrency(budgetAmount)
  const showSettingsLink = monthlyBudgetState.status === "unset" && isCurrentMonth

  return (
    <Flex direction="column" gap="1" width="100%">
      <Flex justify="between" align="baseline" gap="2" wrap="wrap">
        <Text color="gray" size="2">
          {t("summary.monthlyBudget")}
        </Text>
        <Text color={budgetAmount === null ? "gray" : undefined} size="2">
          {budgetText}
        </Text>
      </Flex>
      {display && (
        <MonthlyBudgetUsageText
          amount={totalExpenditures}
          budget={budgetAmount}
          status={display.status}
          text={display.text}
        />
      )}
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

interface MonthlyBudgetUsageTextProps {
  amount?: number
  budget?: number | null
  error?: boolean
  loading?: boolean
  status?: MonthlyBudgetUsageStatus
  text?: string
}

const MonthlyBudgetUsageText = memo(function MonthlyBudgetUsageText({
  amount,
  budget,
  error = false,
  loading = false,
  status,
  text,
}: MonthlyBudgetUsageTextProps) {
  const { t } = useTranslation()
  const content = error ? t("common.failed") : (text ?? "\u00A0")
  const canShowProgress =
    !loading &&
    !error &&
    amount !== undefined &&
    budget !== null &&
    budget !== undefined &&
    status !== undefined
  const difference = (
    <Skeleton
      loading={loading}
      data-testid={loading ? "budget-difference-skeleton" : undefined}
      style={{ maxWidth: "100%" }}
    >
      <Text
        align="right"
        aria-hidden={loading}
        color={getTextColor(error, status)}
        role={error ? "status" : undefined}
        size={status ? "3" : "1"}
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

  return (
    <Flex align="stretch" direction="column" gap="1" width="100%">
      {canShowProgress && (
        <BudgetProgress
          amount={amount}
          ariaLabel={t("summary.monthlyBudgetProgress")}
          ariaValueText={t("summary.budgetProgressValue", {
            amount: toCurrency(amount),
            budget: toCurrency(budget),
            difference: content,
          })}
          budget={budget}
          status={status}
        />
      )}
      <Flex justify="end" width="100%">
        {difference}
      </Flex>
    </Flex>
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

import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { memo } from "react"
import { useTranslation } from "react-i18next"

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
  const {
    data: monthlyBudgetState,
    error: monthlyBudgetError,
    loading: monthlyBudgetLoading,
  } = useEffectiveMonthlyBudget(targetDate)

  if (totalExpendituresLoading || monthlyBudgetLoading) {
    return <MonthlyBudgetUsageText loading />
  }

  if (totalExpendituresError || targetDate === null || totalExpenditures === null) {
    return null
  }

  if (monthlyBudgetError) {
    return <MonthlyBudgetUsageText error />
  }

  const budgetAmount =
    monthlyBudgetState.status === "amount" ? monthlyBudgetState.monthlyBudget.amount : null
  const display = getMonthlyBudgetUsageDisplay(totalExpenditures, budgetAmount)

  if (display === null) {
    return null
  }

  return (
    <MonthlyBudgetUsageText
      amount={totalExpenditures}
      budget={budgetAmount}
      status={display.status}
      text={display.text}
    />
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
        size="1"
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

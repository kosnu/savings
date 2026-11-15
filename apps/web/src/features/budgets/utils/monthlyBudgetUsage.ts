import { i18next } from "../../../i18n"
import { toCurrency } from "../../../utils/toCurrency"

export type MonthlyBudgetUsageStatus = "remaining" | "over"

export interface MonthlyBudgetUsageDisplay {
  text: string
  status: MonthlyBudgetUsageStatus
}

export function getMonthlyBudgetUsageDisplay(
  totalExpenditures: number | null,
  monthlyBudgetAmount: number | null,
  isCurrentMonth = false,
): MonthlyBudgetUsageDisplay | null {
  if (totalExpenditures === null || monthlyBudgetAmount === null) {
    return null
  }

  const difference = monthlyBudgetAmount - totalExpenditures

  if (difference >= 0) {
    return {
      text: i18next.t(isCurrentMonth ? "summary.currentBudgetLeft" : "common.left", {
        amount: toCurrency(difference),
      }),
      status: "remaining",
    }
  }

  return {
    text: i18next.t(isCurrentMonth ? "summary.currentBudgetOver" : "common.over", {
      amount: toCurrency(Math.abs(difference)),
    }),
    status: "over",
  }
}

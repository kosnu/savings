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
): MonthlyBudgetUsageDisplay | null {
  if (totalExpenditures === null || monthlyBudgetAmount === null) {
    return null
  }

  const difference = monthlyBudgetAmount - totalExpenditures

  if (difference >= 0) {
    return {
      text: i18next.t("common.left", { amount: toCurrency(difference) }),
      status: "remaining",
    }
  }

  return {
    text: i18next.t("common.over", { amount: toCurrency(Math.abs(difference)) }),
    status: "over",
  }
}

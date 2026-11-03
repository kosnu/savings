import { getDaysInMonth } from "date-fns"

import {
  formatTargetMonthKey,
  parseDateOnlyStringToLocalDate,
  toTargetMonth,
} from "../../../domain/date"

export interface SpendingMonth {
  month: string
  payments: { date: string; amount: number }[]
}

export interface SpendingPoint {
  day: number
  amount: number
}

export function buildSpendingSeries(
  payments: { date: string; amount: number }[],
  targetDate: Date,
  today: Date,
  history: SpendingMonth[] = [],
) {
  const month = formatTargetMonthKey(toTargetMonth(targetDate))
  const currentMonth = formatTargetMonthKey(toTargetMonth(today))
  const period = month < currentMonth ? "past" : month > currentMonth ? "future" : "current"
  const days = getDaysInMonth(targetDate)
  const throughDay = period === "current" ? today.getDate() : days
  const amounts = Array<number>(days + 1).fill(0)
  for (const payment of payments) {
    if (payment.date.startsWith(`${month}-`)) {
      amounts[Number(payment.date.slice(-2))] += payment.amount
    }
  }
  let cumulative = 0
  const recorded = amounts.map((amount, day) => {
    cumulative += amount
    return { day, amount: cumulative }
  })
  const actual = recorded.slice(0, throughDay + 1)
  const actualTotal = actual[actual.length - 1].amount
  const historyAmounts = history
    .filter(({ payments: rows }) => rows.length > 0)
    .map(({ month: historyMonth, payments: rows }) => {
      const lastDay = getDaysInMonth(parseDateOnlyStringToLocalDate(`${historyMonth}-01`))
      const daily = Array<number>(days + 1).fill(0)
      for (const row of rows) {
        const sourceDay = Number(row.date.slice(-2))
        // 月末の支払いを対象月の月末へ合わせ、短い月でも欠落させない。
        const day = sourceDay === lastDay ? days : Math.min(sourceDay, days)
        daily[day] += row.amount
      }
      return daily
    })
  const forecast: SpendingPoint[] = []
  if (period === "current" && historyAmounts.length > 0) {
    let estimate = actualTotal
    forecast.push({ day: throughDay, amount: estimate })
    for (let day = throughDay + 1; day <= days; day += 1) {
      const average =
        historyAmounts.reduce((sum, daily) => sum + daily[day], 0) / historyAmounts.length
      estimate += Math.max(average, amounts[day])
      forecast.push({ day, amount: Math.round(estimate) })
    }
  }

  return {
    period,
    days,
    throughDay,
    actual,
    actualTotal,
    forecast,
    forecastTotal: forecast.length ? forecast[forecast.length - 1].amount : null,
  }
}

import { getDaysInMonth } from "date-fns"

import { formatTargetMonthKey, toTargetMonth } from "../../../domain/date"

export interface SpendingPoint {
  day: number
  amount: number
}

export function buildSpendingSeries(
  payments: { date: string; amount: number }[],
  targetDate: Date,
  today: Date,
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
  const forecast =
    period === "current"
      ? recorded.slice(throughDay).map(({ day, amount }) => ({
          day,
          amount: Math.max(Math.round((actualTotal * day) / throughDay), amount),
        }))
      : []

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

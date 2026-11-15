import { Flex, Grid, Text } from "@radix-ui/themes"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { toCurrency } from "../../../../utils/toCurrency"
import type { MonthlyBudgetState } from "../../../budgets"
import { buildSpendingSeries, type SpendingMonth } from "../buildSpendingSeries"

import styles from "./MonthlySpendingGraph.module.css"

interface MonthlySpendingGraphProps {
  payments: { date: string; amount: number }[]
  budget: MonthlyBudgetState
  targetDate: Date
  today: Date
  history?: SpendingMonth[]
}

export function MonthlySpendingGraph({
  payments,
  budget,
  targetDate,
  today,
  history = [],
}: MonthlySpendingGraphProps) {
  const { t } = useTranslation()
  const descriptionId = useId()
  const series = buildSpendingSeries(payments, targetDate, today, history)
  const budgetAmount = budget.status === "amount" ? budget.monthlyBudget.amount : null
  const maximum = Math.max(series.actualTotal, series.forecastTotal ?? 0, budgetAmount ?? 0, 1)
  const plotWidth = 600
  const baseline = 180
  const dayWidth = plotWidth / series.days
  const barWidth = dayWidth * 0.65
  const y = (amount: number) => baseline - (amount / maximum) * baseline
  const bars = [...series.actual.slice(1), ...series.forecast.slice(1)].filter(
    ({ amount }) => amount > 0,
  )
  const actualLabel = t(
    series.period === "future" ? "summary.spendingChart.recorded" : "summary.spendingChart.actual",
  )
  const comparison = series.period === "past" ? series.actualTotal : series.forecastTotal
  const difference = budgetAmount !== null && comparison !== null ? budgetAmount - comparison : null
  const explanation =
    series.period === "past"
      ? t("summary.spendingChart.past")
      : series.period === "future"
        ? t("summary.spendingChart.future")
        : series.forecastTotal === null
          ? t("summary.spendingChart.noHistory")
          : null

  return (
    <Flex direction="column" gap="3">
      <figure
        className={styles.figure}
        aria-label={t("summary.spendingChart.title")}
        aria-describedby={explanation ? descriptionId : undefined}
      >
        <Grid columns="auto 1fr" gap="2">
          <Flex direction="column" justify="between" className={styles.axis} aria-hidden="true">
            <Text size="1" color="gray">
              {toCurrency(maximum)}
            </Text>
            <Text size="1" color="gray">
              {toCurrency(Math.round(maximum / 2))}
            </Text>
            <Text size="1" color="gray">
              {toCurrency(0)}
            </Text>
          </Flex>
          <svg
            className={styles.plot}
            viewBox="-2 -4 604 188"
            preserveAspectRatio="none"
            aria-label={t("summary.spendingChart.graphLabel")}
          >
            {[0, maximum / 2, maximum].map((amount) => (
              <line
                key={amount}
                x1="0"
                y1={y(amount)}
                x2={plotWidth}
                y2={y(amount)}
                className={styles.gridLine}
              />
            ))}
            {bars.map(({ day, amount }) => (
              <rect
                key={day}
                x={(day - 0.5) * dayWidth - barWidth / 2}
                y={y(amount)}
                width={barWidth}
                height={baseline - y(amount)}
                className={day > series.throughDay ? styles.forecast : styles.actual}
              />
            ))}
            {budgetAmount !== null && (
              <line
                x1="0"
                y1={y(budgetAmount)}
                x2={plotWidth}
                y2={y(budgetAmount)}
                className={styles.budget}
              />
            )}
          </svg>
          <span />
          <Flex justify="between" aria-hidden="true">
            <Text size="1" color="gray">
              {t("summary.spendingChart.start")}
            </Text>
            <Text size="1" color="gray">
              {t("summary.spendingChart.day", { day: Math.round(series.days / 2) })}
            </Text>
            <Text size="1" color="gray">
              {t("summary.spendingChart.day", { day: series.days })}
            </Text>
          </Flex>
        </Grid>
        <Flex asChild direction="column" gap="1" mt="3">
          <figcaption>
            <LegendRow
              label={actualLabel}
              amount={toCurrency(series.actualTotal)}
              series="actual"
            />
            {series.forecastTotal !== null && (
              <LegendRow
                label={t("summary.spendingChart.forecast")}
                amount={toCurrency(series.forecastTotal)}
                series="forecast"
              />
            )}
            {budgetAmount !== null && (
              <LegendRow label={t("summary.monthlyBudget")} series="budget" />
            )}
          </figcaption>
        </Flex>
      </figure>
      {difference !== null && (
        <Text as="p" size="2" color={difference < 0 ? "yellow" : "green"}>
          {t(
            series.period === "current"
              ? difference < 0
                ? "summary.spendingChart.overForecast"
                : "summary.spendingChart.remainingForecast"
              : difference < 0
                ? "summary.spendingChart.over"
                : "summary.spendingChart.within",
            { amount: toCurrency(Math.abs(difference)) },
          )}
        </Text>
      )}
      {explanation && (
        <Text as="p" size="1" color="gray" id={descriptionId}>
          {explanation}
        </Text>
      )}
    </Flex>
  )
}

function LegendRow({
  label,
  amount,
  series,
}: {
  label: string
  amount?: string
  series: "actual" | "forecast" | "budget"
}) {
  return (
    <Flex justify="between" gap="3" wrap="wrap">
      <Flex align="center" gap="2">
        <svg width="24" height="12" aria-hidden="true">
          {series === "budget" ? (
            <line x1="0" y1="6" x2="24" y2="6" className={styles.budget} />
          ) : (
            <rect x="8" y="1" width="8" height="10" className={styles[series]} />
          )}
        </svg>
        <Text size="2" color="gray">
          {label}
        </Text>
      </Flex>
      {amount !== undefined && (
        <Text size="2" weight="medium" className={styles.amount}>
          {amount}
        </Text>
      )}
    </Flex>
  )
}

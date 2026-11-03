import { Flex, Grid, Text } from "@radix-ui/themes"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { toCurrency } from "../../../../utils/toCurrency"
import type { MonthlyBudgetState } from "../../../budgets"
import { buildSpendingSeries, type SpendingMonth, type SpendingPoint } from "../buildSpendingSeries"

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
  const x = (day: number) => (day / series.days) * 600
  const y = (amount: number) => 180 - (amount / maximum) * 180
  const points = (values: SpendingPoint[]) =>
    values.map(({ day, amount }) => `${x(day)},${y(amount)}`).join(" ")
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
            aria-label={
              series.period === "future" ? actualLabel : t("summary.spendingChart.graphLabel")
            }
          >
            {[0, maximum / 2, maximum].map((amount) => (
              <line
                key={amount}
                x1="0"
                y1={y(amount)}
                x2="600"
                y2={y(amount)}
                className={styles.gridLine}
              />
            ))}
            {budgetAmount !== null && (
              <line
                x1="0"
                y1={y(budgetAmount)}
                x2="600"
                y2={y(budgetAmount)}
                className={styles.budget}
              />
            )}
            <polyline points={points(series.actual)} className={styles.actual} />
            {series.forecast.length > 0 && (
              <polyline points={points(series.forecast)} className={styles.forecast} />
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
            <AmountRow
              label={actualLabel}
              amount={toCurrency(series.actualTotal)}
              lineClass={styles.actual}
            />
            {series.forecastTotal !== null && (
              <AmountRow
                label={t("summary.spendingChart.forecast")}
                amount={toCurrency(series.forecastTotal)}
                lineClass={styles.forecast}
              />
            )}
            <AmountRow
              label={t("summary.spendingChart.budget")}
              amount={
                budgetAmount === null
                  ? t(budget.status === "none" ? "common.noBudget" : "common.notSet")
                  : toCurrency(budgetAmount)
              }
              lineClass={styles.budget}
            />
          </figcaption>
        </Flex>
      </figure>
      {difference !== null && (
        <Text as="p" size="2" color={difference < 0 ? "yellow" : "green"}>
          {t(
            difference < 0
              ? series.period === "current"
                ? "summary.spendingChart.overForecast"
                : "summary.spendingChart.over"
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

function AmountRow({
  label,
  amount,
  lineClass,
}: {
  label: string
  amount: string
  lineClass: string
}) {
  return (
    <Flex justify="between" gap="3" wrap="wrap">
      <Flex align="center" gap="2">
        <svg width="24" height="12" aria-hidden="true">
          <line x1="0" y1="6" x2="24" y2="6" className={lineClass} />
        </svg>
        <Text size="2" color="gray">
          {label}
        </Text>
      </Flex>
      <Text size="2" weight="medium" className={styles.amount}>
        {amount}
      </Text>
    </Flex>
  )
}

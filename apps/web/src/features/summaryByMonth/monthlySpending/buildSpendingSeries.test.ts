import { describe, expect, test } from "vite-plus/test"

import { buildSpendingSeries } from "./buildSpendingSeries"

describe("buildSpendingSeries", () => {
  test("支払いのない日も累積額を維持し、過去の支払日に残日分を積み上げる", () => {
    const result = buildSpendingSeries(
      [
        { date: "2025-06-10", amount: 3000 },
        { date: "2025-06-01", amount: 1000 },
        { date: "2025-06-01", amount: 1000 },
      ],
      new Date(2025, 5, 1),
      new Date(2025, 5, 15),
      [{ month: "2025-05", payments: [{ date: "2025-05-20", amount: 5000 }] }],
    )
    expect(result.actual.map(({ amount }) => amount)).toEqual([
      0, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 5000, 5000, 5000, 5000, 5000, 5000,
    ])
    expect(result.forecast[0]).toEqual({ day: 15, amount: 5000 })
    expect(result.forecastTotal).toBe(10000)
  })

  test("未来に登録された支払いを実績に含めず、見込みが登録済み額を下回らない", () => {
    const result = buildSpendingSeries(
      [
        { date: "2025-06-01", amount: 1000 },
        { date: "2025-06-20", amount: 20000 },
      ],
      new Date(2025, 5, 1),
      new Date(2025, 5, 15),
      [{ month: "2025-05", payments: [{ date: "2025-05-20", amount: 8000 }] }],
    )
    expect(result.actualTotal).toBe(1000)
    expect(result.forecast.find(({ day }) => day === 20)?.amount).toBe(21000)
    expect(result.forecastTotal).toBe(21000)
    expect(
      result.forecast.every((point, i, points) => i === 0 || point.amount >= points[i - 1].amount),
    ).toBe(true)
  })

  test("月外の支払いを含めず、履歴なしは見込みを作らない", () => {
    const result = buildSpendingSeries(
      [{ date: "2025-05-31", amount: 9999 }],
      new Date(2025, 5, 1),
      new Date(2025, 5, 1),
    )
    expect(result.actualTotal).toBe(0)
    expect(result.forecastTotal).toBeNull()
    expect(result.forecast).toHaveLength(0)
  })

  test("過去のうるう月は月末までの実績のみを表示する", () => {
    const result = buildSpendingSeries(
      [{ date: "2024-02-29", amount: 2000 }],
      new Date(2024, 1, 1),
      new Date(2025, 0, 1),
    )
    expect(result.period).toBe("past")
    expect(result.actual).toHaveLength(30)
    expect(result.actualTotal).toBe(2000)
    expect(result.forecastTotal).toBeNull()
  })

  test("未来月は登録済み額のみを表示し、日平均を作らない", () => {
    const result = buildSpendingSeries(
      [{ date: "2026-01-31", amount: 8000 }],
      new Date(2026, 0, 1),
      new Date(2025, 11, 31),
    )
    expect(result.period).toBe("future")
    expect(result.actualTotal).toBe(8000)
    expect(result.forecast).toEqual([])
  })

  test("月初の支出を反復せず、月末は実績と同じ見込みにする", () => {
    const payments = [{ date: "2025-07-01", amount: 101 }]
    expect(
      buildSpendingSeries(payments, new Date(2025, 6, 1), new Date(2025, 6, 1), [
        { month: "2025-06", payments: [{ date: "2025-06-01", amount: 101 }] },
      ]).forecastTotal,
    ).toBe(101)
    const last = buildSpendingSeries(payments, new Date(2025, 6, 1), new Date(2025, 6, 31), [
      { month: "2025-06", payments: [{ date: "2025-06-30", amount: 200 }] },
    ])
    expect(last.forecastTotal).toBe(101)
    expect(last.forecast).toEqual([{ day: 31, amount: 101 }])
  })
  test("空の履歴月は分母へ含めず、日別平均と未来登録額を同日に二重加算しない", () => {
    const result = buildSpendingSeries(
      [
        { date: "2025-06-01", amount: 100 },
        { date: "2025-06-20", amount: 1000 },
      ],
      new Date(2025, 5, 1),
      new Date(2025, 5, 15),
      [
        {
          month: "2025-05",
          payments: [
            { date: "2025-05-20", amount: 1200 },
            { date: "2025-05-25", amount: 400 },
          ],
        },
        {
          month: "2025-04",
          payments: [
            { date: "2025-04-20", amount: 600 },
            { date: "2025-04-25", amount: 800 },
          ],
        },
        { month: "2025-03", payments: [] },
      ],
    )
    expect(result.forecast.find(({ day }) => day === 19)?.amount).toBe(100)
    expect(result.forecast.find(({ day }) => day === 20)?.amount).toBe(1100)
    expect(result.forecast.find(({ day }) => day === 25)?.amount).toBe(1700)
    expect(result.forecastTotal).toBe(1700)
  })

  test("毎日同額の履歴なら直線状の見込みを許容する", () => {
    const result = buildSpendingSeries(
      [{ date: "2025-06-15", amount: 1500 }],
      new Date(2025, 5, 1),
      new Date(2025, 5, 15),
      [
        {
          month: "2025-04",
          payments: Array.from({ length: 30 }, (_, i) => ({
            date: `2025-04-${String(i + 1).padStart(2, "0")}`,
            amount: 100,
          })),
        },
      ],
    )
    expect(result.forecast.map(({ amount }) => amount)).toEqual(
      Array.from({ length: 16 }, (_, i) => 1500 + i * 100),
    )
  })

  test("31日の支出を短い月でも欠落させず、月末支出は月末へ合わせる", () => {
    const result = buildSpendingSeries([], new Date(2024, 1, 1), new Date(2024, 1, 15), [
      {
        month: "2024-01",
        payments: [
          { date: "2024-01-30", amount: 100 },
          { date: "2024-01-31", amount: 200 },
        ],
      },
    ])
    expect(result.forecast.find(({ day }) => day === 28)?.amount).toBe(0)
    expect(result.forecastTotal).toBe(300)
    expect(result.forecast[result.forecast.length - 1].day).toBe(29)
  })

  test("小数となる平均は累積後に円単位へ丸め、日ごとの丸めで失わない", () => {
    const result = buildSpendingSeries([], new Date(2025, 5, 1), new Date(2025, 5, 15), [
      {
        month: "2025-05",
        payments: [
          { date: "2025-05-20", amount: 1 },
          { date: "2025-05-21", amount: 1 },
        ],
      },
      { month: "2025-04", payments: [{ date: "2025-04-01", amount: 0 }] },
      { month: "2025-03", payments: [{ date: "2025-03-01", amount: 0 }] },
    ])
    expect(result.forecastTotal).toBe(1)
  })
})

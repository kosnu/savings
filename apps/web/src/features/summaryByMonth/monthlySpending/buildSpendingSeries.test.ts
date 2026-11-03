import { describe, expect, test } from "vite-plus/test"

import { buildSpendingSeries } from "./buildSpendingSeries"

describe("buildSpendingSeries", () => {
  test("支払いのない日も連続した累積額とし、今日までの日平均から月末を見積もる", () => {
    const result = buildSpendingSeries(
      [
        { date: "2025-06-10", amount: 3000 },
        { date: "2025-06-01", amount: 1000 },
        { date: "2025-06-01", amount: 1000 },
      ],
      new Date(2025, 5, 1),
      new Date(2025, 5, 15),
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
    )
    expect(result.actualTotal).toBe(1000)
    expect(result.forecast.find(({ day }) => day === 20)?.amount).toBe(21000)
    expect(result.forecastTotal).toBe(21000)
    expect(
      result.forecast.every((point, i, points) => i === 0 || point.amount >= points[i - 1].amount),
    ).toBe(true)
  })

  test("0件は0円として推計し、月外の支払いは含めない", () => {
    const result = buildSpendingSeries(
      [{ date: "2025-05-31", amount: 9999 }],
      new Date(2025, 5, 1),
      new Date(2025, 5, 1),
    )
    expect(result.actualTotal).toBe(0)
    expect(result.forecastTotal).toBe(0)
    expect(result.forecast).toHaveLength(30)
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

  test("月初は経過1日、月末は実績と同じ見込みにする", () => {
    const payments = [{ date: "2025-07-01", amount: 101 }]
    expect(
      buildSpendingSeries(payments, new Date(2025, 6, 1), new Date(2025, 6, 1)).forecastTotal,
    ).toBe(3131)
    const last = buildSpendingSeries(payments, new Date(2025, 6, 1), new Date(2025, 6, 31))
    expect(last.forecastTotal).toBe(101)
    expect(last.forecast).toEqual([{ day: 31, amount: 101 }])
  })
})

import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { renderHook, waitFor } from "../../../test/test-utils"
import type { Payment } from "../../../types/payment"
import { fetchPayments } from "./fetchPayments"
import { usePayments } from "./usePayments"

const dateRange: [Date, Date] = [new Date(2025, 5, 1), new Date(2025, 5, 30)]

vi.mock("../../../utils/useDateRange", () => ({
  useDateRange: () => ({
    date: dateRange[0],
    dateRange,
  }),
}))

vi.mock("./fetchPayments", () => ({
  fetchPayments: vi.fn(),
}))

function buildPayment(id: number): Payment {
  return {
    id,
    amount: 1000 + id,
    categoryId: 10,
    date: new Date(2025, 5, id),
    note: `payment ${id}`,
    userId: 100,
    createdDate: new Date("2025-06-01T00:00:00.000Z"),
    updatedDate: new Date("2025-06-01T00:00:00.000Z"),
  }
}

describe("usePayments", () => {
  beforeEach(() => {
    vi.mocked(fetchPayments).mockReset()
  })

  test("カテゴリIDを指定するとカテゴリ条件を渡して支払い一覧を取得する", async () => {
    const payment = buildPayment(1)
    vi.mocked(fetchPayments).mockResolvedValue([payment])

    const { result } = renderHook(() => usePayments({ categoryId: 10 }))

    await waitFor(() => {
      expect(result.current.data).toEqual([payment])
    })
    expect(fetchPayments).toHaveBeenCalledTimes(1)
    expect(fetchPayments).toHaveBeenCalledWith(dateRange, { categoryId: 10 })
  })

  test("カテゴリIDが変わると別queryとして取得し直す", async () => {
    const firstPayment = buildPayment(1)
    const secondPayment = buildPayment(2)
    vi.mocked(fetchPayments)
      .mockResolvedValueOnce([firstPayment])
      .mockResolvedValueOnce([secondPayment])

    const { result, rerender } = renderHook(
      ({ categoryId }: { categoryId: number }) => usePayments({ categoryId }),
      {
        initialProps: { categoryId: 10 },
      },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([firstPayment])
    })

    rerender({ categoryId: 20 })

    await waitFor(() => {
      expect(fetchPayments).toHaveBeenCalledTimes(2)
    })
    expect(fetchPayments).toHaveBeenNthCalledWith(1, dateRange, { categoryId: 10 })
    expect(fetchPayments).toHaveBeenNthCalledWith(2, dateRange, { categoryId: 20 })
  })

  test("カテゴリ条件なしではカテゴリ条件を渡さない", async () => {
    const payment = buildPayment(1)
    vi.mocked(fetchPayments).mockResolvedValue([payment])

    const { result } = renderHook(() => usePayments())

    await waitFor(() => {
      expect(result.current.data).toEqual([payment])
    })
    expect(fetchPayments).toHaveBeenCalledWith(dateRange, { categoryId: undefined })
  })
})

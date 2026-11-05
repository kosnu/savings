import { createRoute, RouterProvider } from "@tanstack/react-router"
import { renderHook } from "@testing-library/react"
import type { PropsWithChildren, ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { paymentsSearchSchema } from "../features/payments"
import { createTestRouter } from "../test/helpers/createTestRouter"
import { waitFor } from "../test/test-utils"
import { useDateRange } from "./useDateRange"

function formatDate(date: Date | null) {
  return date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : "null"
}

function renderUseDateRange(initialEntry: string) {
  let routeChildren: ReactNode = null
  const router = createTestRouter(initialEntry, (root) => {
    const authenticatedRoute = createRoute({
      getParentRoute: () => root,
      id: "authenticated",
    })

    const paymentsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/payments",
      component: () => <>{routeChildren}</>,
      validateSearch: paymentsSearchSchema,
    })

    return [authenticatedRoute.addChildren([paymentsRoute])]
  })

  return renderHook(() => useDateRange(), {
    wrapper: ({ children }: PropsWithChildren) => {
      routeChildren = children

      return <RouterProvider router={router} />
    },
  })
}

describe("useDateRange", () => {
  afterEach(() => vi.useRealTimers())
  test("有効な年月クエリから対象月の開始日と終了日を返す", async () => {
    const { result } = renderUseDateRange("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(formatDate(result.current.date)).toBe("2025-5-1")
      expect(formatDate(result.current.dateRange[0])).toBe("2025-5-1")
      expect(formatDate(result.current.dateRange[1])).toBe("2025-5-31")
    })
  })

  test.each([
    ["/payments?year=abc&month=5"],
    ["/payments?year=2025&month=abc"],
    ["/payments?year=2025&month=0"],
    ["/payments?year=2025&month=13"],
    ["/payments?year=2021&month=12"],
    ["/payments?year=2033&month=1"],
    ["/payments?year=999999999999999&month=1"],
  ])("不正な年月クエリ %s は表示と同じ今月の期間を返す", async (initialEntry) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 15))
    const { result } = renderUseDateRange(initialEntry)

    await waitFor(() => {
      expect(formatDate(result.current.date)).toBe("2026-10-1")
      expect(result.current.dateRange).toEqual([
        new Date(2026, 9, 1),
        new Date(2026, 9, 31, 23, 59, 59, 999),
      ])
    })
  })
})

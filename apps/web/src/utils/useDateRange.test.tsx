import { createRoute, RouterProvider } from "@tanstack/react-router"
import { renderHook } from "@testing-library/react"
import type { PropsWithChildren, ReactNode } from "react"
import { describe, expect, test } from "vite-plus/test"

import { paymentsSearchSchema } from "../features/payments/listPayment/paymentsSearchSchema"
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
  ])("不正な年月クエリ %s は無効扱いにする", async (initialEntry) => {
    const { result } = renderUseDateRange(initialEntry)

    await waitFor(() => {
      expect(result.current.date).toBeNull()
      expect(result.current.dateRange).toEqual([null, null])
    })
  })
})

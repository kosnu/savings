import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"
import { http } from "msw"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"

import { mockSession } from "../../../test/data/supabaseSession"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { createTestQueryClient, render, screen, waitFor } from "../../../test/test-utils"
import { router as appRouter } from "../../routes"

beforeEach(() => {
  server.resetHandlers(
    ...createBookHandlers(),
    ...createCategoryHandlers(),
    ...createMonthlyBudgetHandlers(),
    ...createPaymentHandlers(),
  )
})

afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})

test.each([
  ["?year=2022&month=1", 2026, 10, "2022", "1"],
  ["?year=2032&month=12", 2026, 10, "2032", "12"],
  ["?year=2021&month=12", 2026, 10, "2026", "10"],
  ["?year=2033&month=1", 2026, 10, "2026", "10"],
  ["?year=999999999999999&month=1", 2026, 10, "2026", "10"],
  ["?year=foo&month=1", 2026, 10, "2026", "10"],
  ["?year=2026&month=13", 2026, 10, "2026", "10"],
  ["?year=2025", 2026, 10, "2025", "10"],
  ["?month=6", 2026, 10, "2026", "6"],
  ["", 2021, 12, "2022", "1"],
  ["", 2033, 1, "2032", "12"],
] as const)(
  "一覧URL %s（現在月 %s-%s）は表示・検索期間を一致させる",
  async (search, currentYear, currentMonth, year, month) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(currentYear, currentMonth - 1, 15, 12))
    const requests: URL[] = []
    server.use(
      http.get("*/rest/v1/payments", ({ request }) => {
        requests.push(new URL(request.url))
      }),
    )
    // URL検証前の誤取得も検出するため、本番のroute treeとAPI境界を通す。
    const router = createRouter({
      routeTree: appRouter.options.routeTree,
      history: createMemoryHistory({ initialEntries: [`/payments${search}`] }),
      parseSearch: appRouter.options.parseSearch,
      stringifySearch: appRouter.options.stringifySearch,
      context: { authStatus: "authenticated", supabaseSession: mockSession() },
    })
    const queryClient = createTestQueryClient()
    render(<RouterProvider router={router} />, { queryClient })

    await waitFor(() => expect(requests.length).toBeGreaterThan(0))
    const label = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" }).format(
      new Date(Number(year), Number(month) - 1, 1),
    )
    expect(await screen.findByRole("button", { name: label })).toBeInTheDocument()
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(router.state.location.search).toMatchObject({ year, month })
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    for (const request of requests) {
      expect(request.searchParams.getAll("date")).toEqual([
        `gte.${year}-${month.padStart(2, "0")}-01`,
        `lte.${year}-${month.padStart(2, "0")}-${lastDay}`,
      ])
    }
  },
)

test("範囲外の詳細URLを正規化しても詳細IDとカテゴリ条件を保持する", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
  const router = createRouter({
    routeTree: appRouter.options.routeTree,
    history: createMemoryHistory({
      initialEntries: ["/payments/details/2?year=2033&month=1&category=20"],
    }),
    parseSearch: appRouter.options.parseSearch,
    stringifySearch: appRouter.options.stringifySearch,
    context: { authStatus: "authenticated", supabaseSession: mockSession() },
  })
  const { user } = render(<RouterProvider router={router} />)
  expect(await screen.findByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe("/payments/details/2")
  expect(router.state.location.search).toEqual({ year: "2026", month: "10", category: "20" })
  await user.click(screen.getByRole("button", { name: /close payment details/i }))
  await waitFor(() => expect(router.state.location.pathname).toBe("/payments"))
  expect(router.state.location.search).toEqual({ year: "2026", month: "10", category: "20" })
})

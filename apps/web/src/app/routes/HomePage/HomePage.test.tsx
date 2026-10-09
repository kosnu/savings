import { composeStories } from "@storybook/react-vite"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"
import { HttpResponse, delay, http } from "msw"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import * as accountLanguage from "../../../i18n/accountLanguage"
import { getSupabaseClient } from "../../../lib/supabase"
import * as authenticatedUser from "../../../providers/supabase/ensureAuthenticatedUser"
import {
  SupabaseSessionContext,
  SupabaseSessionProvider,
} from "../../../providers/supabase/SupabaseSessionProvider"
import { payments } from "../../../test/data/payments"
import { mockSession } from "../../../test/data/supabaseSession"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../../test/test-utils"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { router as appRouter } from "../../routes"
import * as stories from "./HomePage.stories"

const {
  Default,
  Empty,
  Loading,
  Error: ErrorStory,
  Unauthenticated,
  RestoringSession,
} = composeStories(stories)

function resetHandlers() {
  server.resetHandlers(
    ...createBookHandlers(),
    ...createPaymentHandlers(),
    ...createCategoryHandlers(),
    ...createMonthlyBudgetHandlers(),
  )
}

function renderAuthenticatedHome() {
  const session = mockSession()
  const auth = getSupabaseClient().auth
  let callback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
  vi.spyOn(auth, "getSession").mockResolvedValue({ data: { session }, error: null })
  vi.spyOn(auth, "getUser").mockResolvedValue({ data: { user: session.user }, error: null })
  vi.spyOn(auth, "onAuthStateChange").mockImplementation((nextCallback) => {
    callback = nextCallback
    return {
      data: {
        subscription: { id: "home-auth-test", callback: nextCallback, unsubscribe: vi.fn() },
      },
    }
  })
  vi.spyOn(authenticatedUser, "ensureAuthenticatedUser").mockResolvedValue(undefined)
  vi.spyOn(accountLanguage, "loadAccountLanguage").mockResolvedValue("en")
  const queryClient = createTestQueryClient()
  render(
    <SupabaseSessionProvider>
      <Default />
    </SupabaseSessionProvider>,
    { queryClient },
  )
  return {
    queryClient,
    emitSession: (event: AuthChangeEvent, nextSession: Session) => {
      act(() => {
        if (!callback) throw new Error("Auth callback has not been registered.")
        callback(event, nextSession)
      })
    },
  }
}

describe("HomePage", () => {
  beforeEach(resetHandlers)
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    server.resetHandlers()
  })

  test.each([
    ["/?year=2025&month=6", "2025", "6"],
    ["/?year=2022&month=1", "2022", "1"],
    ["/?year=2032&month=12", "2032", "12"],
    ["/", "2026", "10"],
    ["/?year=2025", "2025", "10"],
    ["/?month=6", "2026", "6"],
    ["/?year=foo&month=1", "2026", "10"],
    ["/?year=2026&month=foo", "2026", "10"],
    ["/?year=2026&month=0", "2026", "10"],
    ["/?year=2026&month=13", "2026", "10"],
    ["/?year=2026&month=1.5", "2026", "10"],
    ["/?year=&month=1", "2026", "10"],
    ["/?year=2021&month=12", "2026", "10"],
    ["/?year=2033&month=1", "2026", "10"],
  ])("URLの検証と初期化 %s は月表示と集計条件を一致させる", async (entry, year, month) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 9, 12))
    const requestedMonths: string[] = []
    server.use(
      http.post("*/rest/v1/rpc/get_monthly_total_amount", async ({ request }) => {
        const body = (await request.json()) as { p_month: string }
        requestedMonths.push(body.p_month)
        return HttpResponse.json(5000)
      }),
    )
    // URLの検証と初期化を含む経路を確認するため、本番のroute treeを使う。
    const router = createRouter({
      routeTree: appRouter.options.routeTree,
      history: createMemoryHistory({ initialEntries: [entry] }),
      parseSearch: appRouter.options.parseSearch,
      stringifySearch: appRouter.options.stringifySearch,
      context: { authStatus: "authenticated", supabaseSession: mockSession() },
    })
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥5,000")
    })
    const expectedMonth = new Intl.DateTimeFormat("en", { year: "numeric", month: "long" }).format(
      new Date(Number(year), Number(month) - 1, 1),
    )
    expect(screen.getByRole("button", { name: expectedMonth })).toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ year, month })
    const url = new URL(router.state.location.href, "https://example.com")
    expect(url.searchParams.get("year")).toBe(year)
    expect(url.searchParams.get("month")).toBe(month)
    expect(requestedMonths.length).toBeGreaterThan(0)
    expect(requestedMonths.every((value) => value === `${year}-${month.padStart(2, "0")}`)).toBe(
      true,
    )
    expect(screen.queryByRole("button", { name: "Select year and month" })).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("月次集計と全期間の直近5件を表示し、検索は表示しない", async () => {
    const requests: URL[] = []
    const rows = Array.from({ length: 6 }, (_, index) => ({
      ...mapPaymentToRow(payments[0]),
      id: 10 - index,
      note: `支払い${index + 1}`,
      date: index < 3 ? "2025-06-15" : "2025-05-15",
    }))
    // APIが要求した件数より多く返しても、トップには最大5件だけを表示する。
    server.use(
      http.get("*/rest/v1/payments", ({ request }) => {
        const url = new URL(request.url)
        // 同じendpointの未分類集計は既存handlerに委ねる。
        if (url.searchParams.get("select") === "amount,date") return
        requests.push(url)
        return HttpResponse.json(rows)
      }),
    )
    const { user } = render(<Default />)

    const recent = await screen.findByLabelText("Recent payments")
    await waitFor(() => {
      expect(within(recent).getAllByRole("button")).toHaveLength(5)
    })
    expect(within(recent).getByText("支払い5")).toBeInTheDocument()
    expect(within(recent).queryByText("支払い6")).not.toBeInTheDocument()
    expect(await screen.findByLabelText("Total spending")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: /category filter/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /create payment/i })).toBeInTheDocument()
    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      expect(request.searchParams.get("book_id")).toBe("eq.1")
      expect(request.searchParams.get("limit")).toBe("5")
      expect(request.searchParams.get("order")).toBe("date.desc,id.desc")
      expect(request.searchParams.has("date")).toBe(false)
      expect(request.searchParams.has("category_id")).toBe(false)
    }

    await user.click(screen.getByRole("button", { name: /next month/i }))
    expect(await screen.findByRole("button", { name: "July 2025" })).toBeInTheDocument()
    expect(within(recent).getAllByRole("button")).toHaveLength(5)
  })

  test("5件未満なら存在する件数だけ表示する", async () => {
    render(<Default />)
    const recent = await screen.findByLabelText("Recent payments")
    await waitFor(() => {
      expect(within(recent).getAllByRole("button")).toHaveLength(4)
    })
    expect(within(recent).getByText("Apr 1, 2025")).toBeInTheDocument()
  })

  test.each(["loading", "error"] as const)(
    "直近一覧が%sでも月次・カテゴリ別集計を表示する",
    async (state) => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      server.use(
        http.get("*/rest/v1/payments", async ({ request }) => {
          if (new URL(request.url).searchParams.get("select") === "amount,date") return
          if (state === "loading") await delay("infinite")
          return HttpResponse.json({ message: "failed" }, { status: 500 })
        }),
      )
      render(<Default />)
      await waitFor(() => {
        expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥5,000")
      })
      expect(
        await screen.findByRole("progressbar", { name: "Food budget progress" }),
      ).toHaveAttribute("aria-valuenow", "1000")
      if (state === "loading") {
        expect(screen.getAllByLabelText("loading-payment-item")).toHaveLength(3)
      } else {
        expect(await screen.findByRole("alert")).toHaveTextContent("Could not load payments.")
      }
    },
  )

  test("支払いがない場合は0円の集計と空状態を表示する", async () => {
    server.resetHandlers(
      ...createBookHandlers(),
      ...createPaymentHandlers({ initialRows: [] }),
      ...createCategoryHandlers({ get: { paymentRows: [] } }),
      ...createMonthlyBudgetHandlers(),
    )
    render(<Empty />)
    expect(await screen.findByText("No payments found.")).toBeInTheDocument()
    const total = await screen.findByLabelText("Total spending")
    expect(total).toHaveTextContent("¥0")
  })

  test("Book取得中は支払いAPIを呼ばず、追加を表示しない", async () => {
    let requests = 0
    server.resetHandlers(...createBookHandlers({ durationOrMode: "infinite" }))
    server.use(
      http.get("*/rest/v1/payments", () => {
        requests += 1
        return HttpResponse.json([])
      }),
    )
    render(<Loading />)
    expect(await screen.findByRole("link", { name: "Burneto — Home" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /create payment/i })).not.toBeInTheDocument()
    expect(requests).toBe(0)
  })

  test("Book取得失敗を空状態と区別する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createBookHandlers({ error: true }))
    render(<ErrorStory />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed")
    expect(screen.queryByText("No payments found.")).not.toBeInTheDocument()
  })

  test("Book取得失敗後に同じ認証ユーザーのまま再試行してトップへ復帰できる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createBookHandlers({ error: true }))
    const { user } = render(<ErrorStory />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed")
    resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥5,000")
    })
    expect(await screen.findByLabelText("Recent payments")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("Book取得失敗後に認証ユーザーが変わるとトップの表示を復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createBookHandlers({ error: true }))
    function Scenario() {
      const [session, setSession] = useState(mockSession())
      return (
        <SupabaseSessionContext value={{ session, status: "authenticated" }}>
          <Default />
          <button
            onClick={() => setSession({ ...session, user: { ...session.user, id: "new-user" } })}
          >
            Change user
          </button>
        </SupabaseSessionContext>
      )
    }
    const { user } = render(<Scenario />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed")
    resetHandlers()
    await user.click(screen.getByRole("button", { name: "Change user" }))
    expect(await screen.findByLabelText("Recent payments")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("正常取得した集計cacheがあっても別ユーザーへ切り替えると旧データを表示しない", async () => {
    let total = 5000
    let requests = 0
    server.use(
      http.post("*/rest/v1/rpc/get_monthly_total_amount", async () => {
        requests += 1
        await delay(50)
        return HttpResponse.json(total)
      }),
    )
    const { emitSession } = renderAuthenticatedHome()
    await waitFor(() => {
      expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥5,000")
    })
    expect(
      await screen.findByRole("progressbar", { name: "Food budget progress" }),
    ).toHaveAttribute("aria-valuenow", "1000")
    const initialRequests = requests
    total = 500
    server.use(
      ...createCategoryHandlers({
        get: {
          response: [
            {
              id: 10,
              book_id: 1,
              name: "New category",
              created_at: "2025-01-01",
              updated_at: "2025-01-01",
            },
          ],
          paymentRows: [],
        },
      }),
    )
    const session = mockSession()
    emitSession("SIGNED_IN", { ...session, user: { ...session.user, id: "new-user" } })
    expect(screen.queryByText("¥5,000")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("progressbar", { name: "Food budget progress" }),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥500")
    })
    expect(await screen.findByText("New category")).toBeInTheDocument()
    expect(
      screen.queryByRole("progressbar", { name: "Food budget progress" }),
    ).not.toBeInTheDocument()
    expect(requests).toBeGreaterThan(initialRequests)
  })

  test("同じユーザーのトークン更新では正常取得したcacheを維持する", async () => {
    let requests = 0
    server.use(
      http.post("*/rest/v1/rpc/get_monthly_total_amount", () => {
        requests += 1
        return HttpResponse.json(5000)
      }),
    )
    const { queryClient, emitSession } = renderAuthenticatedHome()
    await waitFor(() => {
      expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥5,000")
    })
    await screen.findByRole("progressbar", { name: "Food budget progress" })
    const clear = vi.spyOn(queryClient, "clear")
    const initialRequests = requests
    emitSession("TOKEN_REFRESHED", { ...mockSession(), access_token: "refreshed-token" })
    await waitFor(() => expect(accountLanguage.loadAccountLanguage).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥5,000")
    expect(clear).not.toHaveBeenCalled()
    expect(requests).toBe(initialRequests)
  })

  test("未認証時には紹介画面を表示する", async () => {
    render(<Unauthenticated />)
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Know what’s left.")
    expect(screen.queryByLabelText("Recent payments")).not.toBeInTheDocument()
  })

  test("セッション復元中は紹介画面も支払いも表示しない", async () => {
    render(<RestoringSession />)
    expect(await screen.findByRole("link", { name: "Burneto — Home" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Recent payments")).not.toBeInTheDocument()
  })

  test("直近の支払いから該当月の詳細へ移動できる", async () => {
    const { user } = render(<Default />)
    const recent = await screen.findByLabelText("Recent payments")
    await user.click(await within(recent).findByRole("button", { name: /Apr 1, 2025/ }))
    expect(
      await screen.findByRole("button", { name: "April 2025", hidden: true }),
    ).toBeInTheDocument()
    expect(await screen.findByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
  })

  test("トップから追加すると直近一覧と月次集計が再取得される", async () => {
    const created = {
      ...mapPaymentToRow(payments[0]),
      id: 999,
      date: "2025-06-15",
      note: "追加した支払い",
      amount: 1080,
    }
    server.resetHandlers(
      ...createBookHandlers(),
      ...createPaymentHandlers({ create: { response: created } }),
      ...createCategoryHandlers(),
      ...createMonthlyBudgetHandlers(),
    )
    const { user } = render(<Default />)
    const recent = await screen.findByLabelText("Recent payments")
    await within(recent).findByText("スーパー")
    await user.click(screen.getByRole("button", { name: /create payment/i }))
    const dialog = await screen.findByRole("dialog", { name: /create payment/i })
    await user.type(within(dialog).getByLabelText(/amount/i), "1080")
    server.resetHandlers(
      ...createBookHandlers(),
      ...createPaymentHandlers({
        initialRows: [...payments.map(mapPaymentToRow), created],
        create: { response: created },
      }),
      ...createCategoryHandlers({
        get: { paymentRows: [...payments.map(mapPaymentToRow), created] },
      }),
      ...createMonthlyBudgetHandlers(),
    )
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /create payment/i })).not.toBeInTheDocument()
    })
    expect(await within(recent).findByText("追加した支払い")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText("Total spending")).toHaveTextContent("¥6,080")
    })
  })
})

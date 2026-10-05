import { composeStories } from "@storybook/react-vite"
import { HttpResponse, delay, http } from "msw"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { payments } from "../../../test/data/payments"
import { mockSession } from "../../../test/data/supabaseSession"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen, waitFor, within } from "../../../test/test-utils"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
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

describe("HomePage", () => {
  beforeEach(resetHandlers)
  afterEach(() => {
    vi.restoreAllMocks()
    server.resetHandlers()
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
    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument()
    expect(await screen.findByLabelText("Recent payments")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
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

import { composeStories } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { HttpResponse, delay, http } from "msw"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { payments } from "../../../../test/data/payments"
import { renderWithRouter } from "../../../../test/helpers/renderWithRouter"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../../../test/test-utils"
import { mapPaymentToRow } from "../../../../test/utils/mapPaymentToRow"
import { paymentQueryKeys } from "../../queryKeys"
import { paymentsSearchSchema } from "../paymentsSearchSchema"
import { RecentPayments } from "./RecentPayments"
import * as stories from "./RecentPayments.stories"

const { Empty, Loading, Error: ErrorStory } = composeStories(stories)

// Storyのrouterは初期argsを保持するため、同じ境界での条件変更は専用の操作で検証する。
function renderRecoveryScenario() {
  function Scenario() {
    const [bookId, setBookId] = useState(stories.default.args.bookId)
    const [cacheScope, setCacheScope] = useState(stories.default.args.cacheScope)
    return (
      <>
        <RecentPayments bookId={bookId} cacheScope={cacheScope} />
        <button onClick={() => setBookId(2)}>Change Book</button>
        <button onClick={() => setCacheScope("new-scope")}>Change scope</button>
      </>
    )
  }
  return renderWithRouter("/?year=2025&month=6", (root) => [
    createRoute({ getParentRoute: () => root, path: "/", component: Scenario }),
  ])
}

describe("RecentPayments", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })
  afterEach(() => {
    vi.useRealTimers()
    server.resetHandlers()
    vi.restoreAllMocks()
  })

  test("読み込み中はスケルトンを表示する", async () => {
    server.resetHandlers(...createPaymentHandlers({ get: { durationOrMode: "infinite" } }))
    render(<Loading />)
    expect(await screen.findAllByLabelText("loading-payment-item")).toHaveLength(5)
    expect(
      screen.queryByText("No payments for June. Use “Create payment” to record one."),
    ).not.toBeInTheDocument()
  })

  test("空状態では既存ボタンからの支払い登録を案内する", async () => {
    server.resetHandlers(...createPaymentHandlers({ initialRows: [] }))
    render(<Empty />)
    expect(
      await screen.findByText("No payments for June. Use “Create payment” to record one."),
    ).toBeInTheDocument()
  })

  test("選択月の支払いを詳細URLで開く", async () => {
    const row = {
      ...mapPaymentToRow(payments[0]),
      date: "2025-06-15",
      note: "保存日を保持する支出",
    }
    server.resetHandlers(...createPaymentHandlers({ initialRows: [row] }))
    // 詳細URLとsearchの遷移を検証するため、Storyの固定routerではなく遷移先を持つrouterを使う。
    const { router, user } = renderWithRouter("/?year=2025&month=6", (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/",
        component: () => <RecentPayments {...stories.default.args} />,
      }),
      createRoute({
        getParentRoute: () => root,
        path: "/payments/details/$paymentId",
        validateSearch: paymentsSearchSchema,
        component: () => <div>詳細の遷移先</div>,
      }),
    ])
    const payment = await screen.findByRole("button", { name: /保存日を保持する支出/ })
    expect(payment).toHaveTextContent("Jun 15, 2025")

    await user.click(payment)

    expect(await screen.findByText("詳細の遷移先")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/payments/details/${row.id}`)
    expect(router.state.location.search).toEqual({ year: "2025", month: "6" })
  })

  test("同じBookのまま再試行し、取得失敗から正常表示へ復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const requests: URL[] = []
    server.use(
      http.get("*/rest/v1/payments", async ({ request }) => {
        requests.push(new URL(request.url))
        if (requests.length === 1) {
          return HttpResponse.json({ message: "failed" }, { status: 500 })
        }
        await delay(50)
        return HttpResponse.json(payments.slice(0, 2).map(mapPaymentToRow))
      }),
    )
    const { user } = render(<ErrorStory />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load payments.")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findAllByLabelText("loading-payment-item")).toHaveLength(5)
    expect(await screen.findByRole("button", { name: /Jun 2, 2025/ })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(request.searchParams.get("book_id")).toBe("eq.1")
    }
  })

  test("空のキャッシュの再取得が失敗するとエラーを表示し、再試行で復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createPaymentHandlers({ initialRows: [] }))
    const queryClient = createTestQueryClient()
    const { user } = render(<Empty />, { queryClient })
    const emptyMessage = "No payments for June. Use “Create payment” to record one."
    expect(await screen.findByText(emptyMessage)).toBeVisible()

    server.resetHandlers(...createPaymentHandlers({ get: { error: true } }))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: paymentQueryKeys.book(1) })
    })
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load payments.")
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument()

    server.resetHandlers(...createPaymentHandlers({ initialRows: [] }))
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText(emptyMessage)).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("10月の取得に失敗しても11月へ切り替えると月初の支払いを表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const october = { ...mapPaymentToRow(payments[0]), date: "2025-10-31", note: "10月末の支払い" }
    const november = { ...october, id: 2, date: "2025-11-01", note: "11月初の支払い" }
    server.use(
      http.get(
        "*/rest/v1/payments",
        ({ request }) => {
          if (new URL(request.url).searchParams.getAll("date").includes("gte.2025-10-01")) {
            return HttpResponse.json({ message: "failed" }, { status: 500 })
          }
        },
        { once: true },
      ),
      ...createPaymentHandlers({ initialRows: [october, november] }),
    )
    const { router, user } = renderWithRouter("/?year=2025&month=10", (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/",
        component: () => <RecentPayments {...stories.default.args} />,
      }),
    ])
    expect(await screen.findByRole("alert")).toBeVisible()
    await act(async () => {
      await router.navigate({ to: "/", search: { year: "2025", month: "11" } })
    })
    expect(await screen.findByText("11月初の支払い")).toBeVisible()
    expect(screen.queryByText("10月末の支払い")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    await act(async () => {
      await router.navigate({ to: "/", search: { year: "2025", month: "10" } })
    })
    await user.click(await screen.findByRole("button", { name: "Try again" }))
    expect(await screen.findByText("10月末の支払い")).toBeVisible()
    expect(screen.queryByText("11月初の支払い")).not.toBeInTheDocument()
  })

  test("再試行にも失敗した場合はエラーを維持し、再び試せる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    let requests = 0
    server.use(
      http.get("*/rest/v1/payments", () => {
        requests += 1
        return HttpResponse.json({ message: "failed" }, { status: 500 })
      }),
    )
    const { user } = render(<ErrorStory />)
    await screen.findByRole("alert")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(requests).toBe(2))
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load payments.")
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled()
    expect(
      screen.queryByText("No payments for June. Use “Create payment” to record one."),
    ).not.toBeInTheDocument()
  })

  test("取得失敗後にBookが変わると新しいBookの支払いを取得する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const requests: URL[] = []
    server.use(
      http.get("*/rest/v1/payments", ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        if (url.searchParams.get("book_id") === "eq.1")
          return HttpResponse.json({ message: "failed" }, { status: 500 })
        return HttpResponse.json([
          { ...mapPaymentToRow(payments[0]), book_id: 2, note: "別Bookの支払い" },
        ])
      }),
    )
    const { user } = renderRecoveryScenario()
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load payments.")
    await user.click(screen.getByRole("button", { name: "Change Book" }))
    expect(await screen.findByText("別Bookの支払い")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(requests.some((url) => url.searchParams.get("book_id") === "eq.2")).toBe(true)
  })

  test("取得失敗後にcache scopeが変わると正常表示へ復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createPaymentHandlers({ get: { error: true } }))
    const { user } = renderRecoveryScenario()
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    server.resetHandlers(...createPaymentHandlers())
    await user.click(screen.getByRole("button", { name: "Change scope" }))
    const recent = screen.getByLabelText("Payments for June")
    await waitFor(() => {
      expect(within(recent).getAllByRole("button")).toHaveLength(2)
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

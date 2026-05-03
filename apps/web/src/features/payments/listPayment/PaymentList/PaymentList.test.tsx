import { composeStories } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { HttpResponse, http } from "msw"
import { describe, expect, test } from "vite-plus/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { renderWithRouter } from "../../../../test/helpers/renderWithRouter"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor, within } from "../../../../test/test-utils"
import { paymentsSearchSchema } from "../paymentsSearchSchema"
import { PaymentList } from "./PaymentList"
import * as stories from "./PaymentList.stories"

const { Default, Loading } = composeStories(stories)

function renderStory() {
  const queryClient = createQueryClient()

  return render(<Default />, { queryClient })
}

function renderPaymentList(initialEntry: string) {
  return renderWithRouter(
    initialEntry,
    (root) => {
      const authenticatedRoute = createRoute({
        getParentRoute: () => root,
        id: "authenticated",
      })

      const paymentsRoute = createRoute({
        getParentRoute: () => authenticatedRoute,
        path: "/payments",
        component: PaymentList,
        validateSearch: paymentsSearchSchema,
      })

      const paymentDetailsRoute = createRoute({
        getParentRoute: () => paymentsRoute,
        path: "details/$paymentId",
      })

      return [authenticatedRoute.addChildren([paymentsRoute.addChildren([paymentDetailsRoute])])]
    },
    { queryClient: createQueryClient() },
  )
}

describe("PaymentList", () => {
  test("支払い行が button として並び、詳細内に削除導線がある", async () => {
    renderStory()

    expect(await screen.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
  })

  test("キーボード操作で詳細を開いて閉じると元の行へフォーカスが戻る", async () => {
    const { user } = renderStory()

    const firstPaymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    firstPaymentButton.focus()
    expect(firstPaymentButton).toHaveFocus()

    await user.keyboard("{Enter}")

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    expect(await within(dialog).findByText("Daily Necessities")).not.toHaveClass("rt-Badge")
    expect(await within(dialog).findAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(await within(dialog).findByText("Category")).toBeInTheDocument()
    expect(await within(dialog).findByRole("button", { name: /delete/i })).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
      expect(firstPaymentButton).toHaveFocus()
    })
  })

  test("金額編集中の Escape は詳細を閉じず、次の Escape で詳細を閉じる", async () => {
    const { user } = renderStory()

    const firstPaymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(firstPaymentButton)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit amount/i }))

    expect(await within(dialog).findByRole("textbox", { name: /amount/i })).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
    })
  })

  test("削除確認をキャンセルすると詳細へ戻る", async () => {
    const { user } = renderStory()

    const firstPaymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(firstPaymentButton)

    const detailDialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(
      await within(detailDialog).findByRole("button", { name: /delete this payment/i }),
    )

    const deleteDialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    expect(
      screen.getByRole("dialog", { name: /payment details/i, hidden: true }),
    ).toBeInTheDocument()
    await user.click(within(deleteDialog).getByRole("button", { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /delete this payment/i })).not.toBeInTheDocument()
    })

    expect(await screen.findByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
  })

  test("Loading story ではスケルトンを 3 件表示する", async () => {
    render(<Loading />)

    expect(await screen.findAllByLabelText("loading-payment-item")).toHaveLength(3)
  })

  test("支払い行を開くと現在の検索条件を維持して詳細URLへ遷移する", async () => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
    const { router, user } = renderPaymentList("/payments?year=2025&month=6&category=10")

    const paymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(paymentButton)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/payments/details/2")
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
        category: "10",
      })
      expect("paymentId" in router.state.location.search).toBe(false)
    })
    expect(await screen.findByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
  })

  test("詳細URLを直接開くと詳細を表示する", async () => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())

    renderPaymentList("/payments/details/2?year=2025&month=6")

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    expect(await within(dialog).findByText("Daily Necessities")).toBeInTheDocument()
  })

  test("不正な詳細URLの支払いIDはnot foundとして表示する", async () => {
    const requests: URL[] = []
    server.resetHandlers(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requests.push(new URL(request.url))

        return HttpResponse.json([])
      }),
      ...createCategoryHandlers(),
    )

    renderPaymentList("/payments/details/abc?year=2025&month=6")

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    expect(await within(dialog).findByText("Payment not found.")).toBeInTheDocument()
    expect(requests.some((url) => url.searchParams.get("id") === "eq.0")).toBe(false)
  })

  test("詳細表示中にブラウザバックすると一覧URLに戻り詳細を閉じる", async () => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
    const { router, user } = renderPaymentList("/payments?year=2025&month=6")

    const paymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(paymentButton)

    await screen.findByRole("dialog", { name: /payment details/i })
    router.history.back()

    await waitFor(() => {
      expect(router.state.location.href).toBe("/payments?year=2025&month=6")
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
    })
  })

  test("一覧から開いた詳細を閉じると履歴を戻して一覧URLへ戻る", async () => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
    const { router, user } = renderPaymentList("/payments?year=2025&month=6")

    const paymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(paymentButton)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(within(dialog).getByRole("button", { name: /close payment details/i }))

    await waitFor(() => {
      expect(router.state.location.href).toBe("/payments?year=2025&month=6")
      expect(router.state.location.state.__TSR_index).toBe(0)
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
    })
  })

  test("URL searchの登録済みカテゴリIDを一覧取得条件に反映する", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.resetHandlers(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
      ...createCategoryHandlers(),
    )

    renderPaymentList("/payments?year=2025&month=6&category=10")

    await waitFor(() => {
      expect(requestCapture.url?.searchParams.get("category_id")).toBe("eq.10")
    })
  })

  test("URL searchのカテゴリ未設定を一覧取得条件に反映する", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.resetHandlers(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
      ...createCategoryHandlers(),
    )

    renderPaymentList("/payments?year=2025&month=6&category=none")

    await waitFor(() => {
      expect(requestCapture.url?.searchParams.get("category_id")).toBe("is.null")
    })
  })

  test("支払いが0件の場合はカテゴリ取得完了を待たずに空状態を表示する", async () => {
    server.resetHandlers(
      http.get("*/rest/v1/payments*", () => HttpResponse.json([])),
      http.get("*/rest/v1/categories*", async () => {
        await new Promise(() => undefined)
      }),
    )

    renderPaymentList("/payments?year=2025&month=6&category=10")

    expect(await screen.findByText("No payments found.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear filter" })).toBeInTheDocument()
  })

  test("カテゴリ条件なしで支払いが0件の場合はフィルタ解除導線を表示しない", async () => {
    server.resetHandlers(
      http.get("*/rest/v1/payments*", () => HttpResponse.json([])),
      ...createCategoryHandlers(),
    )

    renderPaymentList("/payments?year=2025&month=6")

    expect(await screen.findByText("No payments found.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear filter" })).not.toBeInTheDocument()
  })

  test.each(["0", "-1", "1.2", "abc"])(
    "URL searchの不正カテゴリ %s は一覧取得条件に反映しない",
    async (category) => {
      const requestCapture: { url: URL | null } = { url: null }
      server.resetHandlers(
        http.get("*/rest/v1/payments*", ({ request }) => {
          requestCapture.url = new URL(request.url)

          return HttpResponse.json([])
        }),
        ...createCategoryHandlers(),
      )

      renderPaymentList(`/payments?year=2025&month=6&category=${category}`)

      await waitFor(() => {
        expect(requestCapture.url).not.toBeNull()
        expect(requestCapture.url?.searchParams.has("category_id")).toBe(false)
      })
    },
  )
})

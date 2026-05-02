import { composeStories } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import {
  PAYMENT_SEARCH_CATEGORY_NONE_VALUE,
  paymentsSearchSchema,
} from "../../../features/payments/listPayment/paymentsSearchSchema"
import { createQueryClient } from "../../../lib/queryClient"
import { categories, entertainmentCat } from "../../../test/data/categories"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { payments } from "../../../test/data/payments"
import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen, type TestUser, waitFor, within } from "../../../test/test-utils"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import * as stories from "./PaymentPage.stories"
import { PaymentsPage } from "./PaymentsPage"

const { Default } = composeStories(stories)
const createdPaymentFormInput = {
  amount: 54321,
  categoryName: entertainmentCat.name,
  date: "2025/06/15",
  note: "作成テスト用の支払い",
}
const createdPayment = mapPaymentToRow({
  id: 999,
  categoryId: entertainmentCat.id,
  note: createdPaymentFormInput.note,
  amount: createdPaymentFormInput.amount,
  date: new Date("2025-06-15T00:00:00+09:00"),
  userId: 100,
  createdDate: new Date("2025-06-15T12:00:00+09:00"),
  updatedDate: new Date("2025-06-15T12:00:00+09:00"),
})
const initialPaymentRows = payments.map(mapPaymentToRow)

function createStoryElement(queryClient = createQueryClient()) {
  return {
    queryClient,
    element: <Default />,
  }
}

function renderStory() {
  const { element, queryClient } = createStoryElement()
  const view = render(element, { queryClient })

  return {
    ...view,
    rerenderStory: () => view.rerender(<Default />),
  }
}

function renderPaymentsPageRoute(initialEntry: string) {
  const queryClient = createQueryClient()
  queryClient.setQueryData(["categories"], categories)

  const view = renderWithRouter(
    initialEntry,
    (root) => {
      const authenticatedRoute = createRoute({
        getParentRoute: () => root,
        id: "authenticated",
      })

      const paymentsRoute = createRoute({
        getParentRoute: () => authenticatedRoute,
        path: "/payments",
        component: PaymentsPage,
        validateSearch: paymentsSearchSchema,
      })

      return [authenticatedRoute.addChildren([paymentsRoute])]
    },
    { queryClient },
  )

  return {
    queryClient,
    ...view,
  }
}

async function selectCategoryFilterOption(user: TestUser, optionName: string) {
  await user.click(await screen.findByRole("combobox", { name: /category filter/i }))

  const listbox = await screen.findByRole("listbox")
  await waitFor(() => {
    expect(within(listbox).queryByRole("option", { name: /loading/i })).not.toBeInTheDocument()
  })

  await user.click(await within(listbox).findByRole("option", { name: optionName }))
}

function lastRequest(requests: URL[]): URL | undefined {
  return requests[requests.length - 1]
}

describe("PaymentsPage", () => {
  beforeEach(() => {
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: initialPaymentRows,
        create: {
          response: createdPayment,
        },
      }),
      ...createCategoryHandlers(),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 25000 } },
      }),
    )
  })

  afterEach(() => {
    server.resetHandlers()
    vi.useRealTimers()
  })

  test("初期URL searchの登録済みカテゴリIDを一覧取得条件に反映する", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    renderPaymentsPageRoute("/payments?year=2025&month=6&category=10")

    await waitFor(() => {
      expect(requestCapture.url?.searchParams.get("category_id")).toBe("eq.10")
    })
  })

  test("初期URL searchのカテゴリ未設定を一覧取得条件に反映する", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    renderPaymentsPageRoute(
      `/payments?year=2025&month=6&category=${PAYMENT_SEARCH_CATEGORY_NONE_VALUE}`,
    )

    await waitFor(() => {
      expect(requestCapture.url?.searchParams.get("category_id")).toBe("is.null")
    })
  })

  test("カテゴリ変更時はRouter searchを更新して一覧取得条件へ反映する", async () => {
    const requests: URL[] = []
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requests.push(new URL(request.url))

        return HttpResponse.json([])
      }),
    )
    const { router, user } = renderPaymentsPageRoute("/payments?year=2025&month=6")

    await selectCategoryFilterOption(user, "Food")

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /category filter/i })).toHaveTextContent("Food")
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
        category: "10",
      })
      expect(requests.some((url) => url.searchParams.get("category_id") === "eq.10")).toBe(true)
    })
  })

  test("ブラウザバックでカテゴリ条件を戻す", async () => {
    const requests: URL[] = []
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requests.push(new URL(request.url))

        return HttpResponse.json([])
      }),
    )
    const { queryClient, router, user } = renderPaymentsPageRoute("/payments?year=2025&month=6")

    await selectCategoryFilterOption(user, "Food")

    await waitFor(() => {
      expect(router.state.location.search.category).toBe("10")
      expect(lastRequest(requests)?.searchParams.get("category_id")).toBe("eq.10")
    })

    queryClient.removeQueries({
      queryKey: ["payments"],
      predicate: (query) => query.queryKey[2] === "all-categories",
    })

    router.history.back()

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /category filter/i })).toHaveTextContent(
        "All categories",
      )
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
      })
      expect(lastRequest(requests)?.searchParams.has("category_id")).toBe(false)
    })
  })

  test("支払いを作成すると一覧に追加される", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T12:00:00+09:00"))

    const view = renderStory()
    vi.useRealTimers()
    const { user } = view

    const paymentList = await screen.findByLabelText("payment-list")
    expect(await within(paymentList).findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: /create payment/i }))

    const createDialog = await screen.findByRole("dialog", { name: /create payment/i })
    const categorySelect = within(createDialog).getByRole("combobox", { name: /category/i })
    await user.click(categorySelect)

    const listbox = await screen.findByRole("listbox")
    const categoryOption = await within(listbox).findByRole("option", {
      name: new RegExp(createdPaymentFormInput.categoryName, "i"),
    })
    await user.click(categoryOption)

    await user.type(
      within(createDialog).getByLabelText(/amount/i),
      String(createdPaymentFormInput.amount),
    )
    await user.type(within(createDialog).getByLabelText(/note/i), createdPaymentFormInput.note)
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: [...initialPaymentRows, createdPayment],
        create: {
          response: createdPayment,
        },
      }),
      ...createCategoryHandlers(),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 25000 } },
      }),
    )
    await user.click(within(createDialog).getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /create payment/i })).not.toBeInTheDocument()
    })

    view.rerenderStory()

    const refreshedPaymentList = await screen.findByLabelText("payment-list")
    expect(
      await within(refreshedPaymentList).findByRole("button", {
        name: new RegExp(createdPaymentFormInput.note, "i"),
      }),
    ).toBeInTheDocument()
  }, 10000)

  test("支払いを削除すると一覧から消える", async () => {
    const view = renderStory()
    const { user } = view

    const targetPayment = payments[1]
    const targetLabel = new RegExp(
      `${targetPayment.note}.*￥${targetPayment.amount.toLocaleString("ja-JP")}`,
      "i",
    )

    const paymentList = await screen.findByLabelText("payment-list")
    const paymentButton = await within(paymentList).findByRole("button", { name: targetLabel })
    await user.click(paymentButton)

    const detailDialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(detailDialog).findByRole("button", { name: /delete/i }))

    const deleteDialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: initialPaymentRows.filter((row) => row.id !== targetPayment.id),
        create: {
          response: createdPayment,
        },
      }),
      ...createCategoryHandlers(),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 25000 } },
      }),
    )
    await user.click(within(deleteDialog).getByRole("button", { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
      expect(screen.queryByRole("dialog", { name: /delete this payment/i })).not.toBeInTheDocument()
    })

    view.rerenderStory()

    await waitFor(() => {
      expect(
        within(paymentList).queryByRole("button", { name: targetLabel }),
      ).not.toBeInTheDocument()
    })
  })

  test("金額更新後に削除確認を開くと最新の金額が表示される", async () => {
    const { user } = renderStory()

    const firstPaymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(firstPaymentButton)

    const detailDialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(detailDialog).findByRole("button", { name: /edit amount/i }))

    const amountInput = within(detailDialog).getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: initialPaymentRows.map((row) => {
          if (row.id !== payments[1].id) {
            return row
          }

          return { ...row, amount: 2500 }
        }),
        create: {
          response: createdPayment,
        },
      }),
      ...createCategoryHandlers(),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 25000 } },
      }),
    )
    await user.click(within(detailDialog).getByRole("button", { name: /save amount/i }))

    await waitFor(() => {
      expect(within(detailDialog).getByText(/￥2,500/)).toBeInTheDocument()
    })

    await user.click(within(detailDialog).getByRole("button", { name: /delete this payment/i }))

    const deleteDialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    await waitFor(() => {
      expect(within(deleteDialog).getByText(/￥2,500/)).toBeInTheDocument()
    })
  })
})

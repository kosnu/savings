import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { createQueryClient } from "../../../lib/queryClient"
import { SnackbarProvider } from "../../../providers/snackbar"
import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../providers/theme/ThemeProvider"
import { entertainmentCat } from "../../../test/data/categories"
import { payments } from "../../../test/data/payments"
import { mockSession } from "../../../test/data/supabaseSession"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import * as stories from "./PaymentPage.stories"

const { Default } = composeStories(stories)
const createdPayment = {
  amount: 54321,
  categoryName: entertainmentCat.name,
  date: "2025/06/15",
  note: "作成テスト用の支払い",
}
const createdPaymentRowDate = "2025-06-15"

function createStoryElement(queryClient = createQueryClient()) {
  return {
    queryClient,
    element: (
      <QueryClientProvider client={queryClient}>
        <SupabaseSessionContext value={{ session: mockSession(), status: "authenticated" }}>
          <ThemeProvider>
            <SnackbarProvider>
              <Default />
            </SnackbarProvider>
          </ThemeProvider>
        </SupabaseSessionContext>
      </QueryClientProvider>
    ),
  }
}

function renderStory() {
  const { element, queryClient } = createStoryElement()
  const view = render(element)

  return {
    ...view,
    rerenderStory: () => {
      const { element: rerenderElement } = createStoryElement(queryClient)
      return view.rerender(rerenderElement)
    },
  }
}

describe("PaymentsPage", () => {
  beforeEach(() => {
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: payments.map(mapPaymentToRow),
        create: {
          response: {
            ...createdPayment,
            date: createdPaymentRowDate,
            id: 999,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            category_id: entertainmentCat.id,
            user_id: 100,
          },
        },
      }),
      ...createCategoryHandlers(),
    )
  })

  afterEach(() => {
    cleanup()
    server.resetHandlers()
    vi.useRealTimers()
  })

  test("支払いを作成すると一覧に追加される", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T12:00:00+09:00"))

    const view = renderStory()
    vi.useRealTimers()

    const user = userEvent.setup()

    const paymentList = await screen.findByLabelText("payment-list")
    expect(await within(paymentList).findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: /create payment/i }))

    const createDialog = await screen.findByRole("dialog", { name: /create payment/i })
    const categorySelect = within(createDialog).getByRole("combobox", { name: /category/i })
    await user.click(categorySelect)

    const listbox = await screen.findByRole("listbox")
    const categoryOption = await within(listbox).findByRole("option", {
      name: new RegExp(entertainmentCat.name, "i"),
    })
    await user.click(categoryOption)

    await user.type(within(createDialog).getByLabelText(/amount/i), String(createdPayment.amount))
    await user.type(within(createDialog).getByLabelText(/note/i), createdPayment.note)
    await user.click(within(createDialog).getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /create payment/i })).not.toBeInTheDocument()
    })

    view.rerenderStory()

    const refreshedPaymentList = await screen.findByLabelText("payment-list")
    expect(
      await within(refreshedPaymentList).findByRole("button", {
        name: new RegExp(`${createdPayment.note}`, "i"),
      }),
    ).toBeInTheDocument()
    // await waitFor(
    //   () => {
    //     expect(
    //       within(refreshedPaymentList).getByRole("button", {
    //         name: new RegExp(
    //           `${createdPayment.date} ${createdPayment.categoryName} ${createdPayment.note} ￥${createdPayment.amount.toLocaleString("ja-JP")}`,
    //           "i",
    //         ),
    //       }),
    //     ).toBeInTheDocument()
    //   },
    //   { timeout: 6000 },
    // )
  }, 10000)

  test("支払いを削除すると一覧から消える", async () => {
    const user = userEvent.setup()

    const view = renderStory()

    const targetPayment = payments[1]
    const targetLabel = new RegExp(
      `${targetPayment.note}.*￥${targetPayment.amount.toLocaleString("ja-JP")}`,
      "i",
    )

    const paymentList = await screen.findByLabelText("payment-list")
    const paymentButton = await within(paymentList).findByRole("button", { name: targetLabel })
    await user.click(paymentButton)

    const detailDialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(within(detailDialog).getByRole("button", { name: /delete/i }))

    const deleteDialog = await screen.findByRole("dialog", { name: /delete this payment/i })
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
})

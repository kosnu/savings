import { composeStories } from "@storybook/react-vite"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { createQueryClient } from "../../../lib/queryClient"
import { entertainmentCat } from "../../../test/data/categories"
import { payments } from "../../../test/data/payments"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen, waitFor, within } from "../../../test/test-utils"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import * as stories from "./PaymentPage.stories"

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

describe("PaymentsPage", () => {
  beforeEach(() => {
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: payments.map(mapPaymentToRow),
        create: {
          response: createdPayment,
        },
      }),
      ...createCategoryHandlers(),
    )
  })

  afterEach(() => {
    server.resetHandlers()
    vi.useRealTimers()
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

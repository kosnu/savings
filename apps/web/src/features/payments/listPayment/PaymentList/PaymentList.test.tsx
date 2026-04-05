import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { createQueryClient } from "../../../../lib/queryClient"
import { render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./PaymentList.stories"

const { Default, Loading } = composeStories(stories)

function renderStory() {
  const queryClient = createQueryClient()

  return render(<Default />, { queryClient })
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
})

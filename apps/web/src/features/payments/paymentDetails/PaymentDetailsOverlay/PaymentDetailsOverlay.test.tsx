import { composeStories } from "@storybook/react-vite"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"

import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, within } from "../../../../test/test-utils"
import * as stories from "./PaymentDetailsOverlay.stories"

const { Default, EmptyNote } = composeStories(stories)

describe("PaymentDetailsOverlay", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  test("Default story では削除ボタンと金額編集ボタンを表示する", async () => {
    render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /edit amount/i })).toBeInTheDocument()
  })

  test("note が空でも値領域を維持してプレースホルダを表示する", async () => {
    render(<EmptyNote />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })

    expect(within(dialog).getByText("No note")).toBeInTheDocument()
    expect(within(dialog).getAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })

  test("編集中の Escape はオーバーレイを閉じずに編集だけ解除する", async () => {
    const user = userEvent.setup()

    render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(within(dialog).getByRole("button", { name: /edit amount/i }))

    const amountInput = within(dialog).getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/1,000/)).toBeInTheDocument()
  })
})

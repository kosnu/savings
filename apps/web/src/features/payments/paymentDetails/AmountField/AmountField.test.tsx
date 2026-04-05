import { composeStories } from "@storybook/react-vite"
import { beforeEach, describe, expect, test } from "vitest"

import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./AmountField.stories"

const { Default } = composeStories(stories)

describe("AmountField", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  test("編集ボタンを押すと入力欄を開く", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit amount/i }))

    expect(screen.getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("初期表示ではラベル、金額、編集ボタンが表示される", () => {
    render(<Default />)

    expect(screen.getByText("Amount")).toBeInTheDocument()
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit amount/i })).toBeInTheDocument()
  })

  test("編集中の Escape は編集だけ解除する", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
  })

  test("保存ボタンで金額を保存できる", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.click(screen.getByRole("button", { name: /save amount/i }))

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()
    })

    expect(screen.getByText(/￥2,500/)).toBeInTheDocument()
  })

  test("保存失敗時は編集状態を維持してエラーを表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { error: true },
      }),
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.click(screen.getByRole("button", { name: /save amount/i }))

    expect(
      await screen.findByText("Failed to update amount.", { selector: "span" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("保存中は入力欄と保存ボタンを操作不可にする", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { durationOrMode: 1000 },
      }),
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    const saveButton = screen.getByRole("button", { name: /save amount/i })
    await user.click(saveButton)

    expect(amountInput).toBeDisabled()
    expect(saveButton).toBeDisabled()
    expect(screen.getByLabelText("saving")).toBeInTheDocument()
  })
})

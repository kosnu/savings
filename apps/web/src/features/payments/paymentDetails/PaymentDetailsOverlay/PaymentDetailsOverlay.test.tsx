import { composeStories } from "@storybook/react-vite"
import { beforeEach, describe, expect, test } from "vitest"

import { payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, within } from "../../../../test/test-utils"
import { mapPaymentToRow } from "../../../../test/utils/mapPaymentToRow"
import * as stories from "./PaymentDetailsOverlay.stories"

const { Default, EmptyNote, MissingPayment } = composeStories(stories)

describe("PaymentDetailsOverlay", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  test("Default story では削除ボタンと金額編集ボタンを表示する", async () => {
    render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    expect(await within(dialog).findByRole("button", { name: /delete/i })).toBeInTheDocument()
    expect(await within(dialog).findByRole("button", { name: /edit amount/i })).toBeInTheDocument()
  })

  test("note が空でも値領域を維持してプレースホルダを表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: [
          mapPaymentToRow({
            ...payments[0],
            note: "",
          }),
          ...payments.slice(1).map(mapPaymentToRow),
        ],
      }),
    )

    render(<EmptyNote />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })

    expect(await within(dialog).findByText("No note")).toBeInTheDocument()
    expect(await within(dialog).findAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(await within(dialog).findByRole("button", { name: /delete/i })).toBeInTheDocument()
  })

  test("編集中の Escape はオーバーレイを閉じずに編集だけ解除する", async () => {
    const { user } = render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit amount/i }))

    const amountInput = within(dialog).getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/1,000/)).toBeInTheDocument()
  })

  test("詳細が見つからない場合は description に not found を表示し詳細操作を出さない", async () => {
    render(<MissingPayment />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    expect(
      await within(dialog).findByText("Payment not found.", { selector: "p" }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: /close payment details/i }),
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /edit amount/i })).not.toBeInTheDocument()
  })
})

import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, test } from "vitest"

import { payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor, within } from "../../../../test/test-utils"
import { mapPaymentToRow } from "../../../../test/utils/mapPaymentToRow"
import * as stories from "./PaymentDetailsOverlay.stories"

const { Default, EmptyNote, FetchError, MissingPayment } = composeStories(stories)

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
    await user.click(await within(dialog).findByRole("button", { name: /edit note/i }))

    const noteInput = within(dialog).getByRole("textbox", { name: /note/i })
    await user.clear(noteInput)
    await user.type(noteInput, "ドラッグストア")
    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox", { name: /note/i })).not.toBeInTheDocument()
    expect(within(dialog).getByText("コンビニ")).toBeInTheDocument()
  })

  test("オーバーレイを閉じて再表示すると note の draft はリセットされる", async () => {
    const { user, rerender } = render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit note/i }))

    const noteInput = within(dialog).getByRole("textbox", { name: /note/i })
    await user.clear(noteInput)
    await user.type(noteInput, "ドラッグストア")

    rerender(<Default open={false} />)
    rerender(<Default open />)

    const reopenedDialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(reopenedDialog).findByRole("button", { name: /edit note/i }))

    expect(within(reopenedDialog).getByRole("textbox", { name: /note/i })).toHaveValue("コンビニ")
  })

  test("note 編集中は amount の編集導線を無効化する", async () => {
    const { user } = render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit note/i }))

    expect(within(dialog).getByRole("button", { name: /edit amount/i })).toBeDisabled()
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

  test("詳細取得エラー時は description にエラーを表示し詳細操作を出さない", async () => {
    server.use(
      http.get("*/rest/v1/payments*", () => {
        return HttpResponse.json({
          id: "invalid",
          amount: 1000,
          date: "2025-06-02",
          user_id: 100,
          category: null,
        })
      }),
    )
    render(<FetchError />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await waitFor(() => {
      expect(
        within(dialog).getByText("Failed to load payment details.", { selector: "p" }),
      ).toBeInTheDocument()
    })
    expect(within(dialog).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /edit amount/i })).not.toBeInTheDocument()
  })
})

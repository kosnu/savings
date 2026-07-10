import { composeStories } from "@storybook/react-vite"
import { setDefaultOptions } from "date-fns"
import { enUS, ja } from "date-fns/locale"
import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { payments } from "../../../../test/data/payments"
import { categoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor, within } from "../../../../test/test-utils"
import { mapPaymentToRow } from "../../../../test/utils/mapPaymentToRow"
import * as stories from "./PaymentDetailsOverlay.stories"

const { Default, EmptyNote, FetchError, Loading, MissingPayment } = composeStories(stories)

describe("PaymentDetailsOverlay", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers(), ...categoryHandlers)
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
      ...categoryHandlers,
    )

    render(<EmptyNote />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })

    expect(await within(dialog).findByText("No note")).toBeInTheDocument()
    expect(await within(dialog).findAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(await within(dialog).findByRole("button", { name: /delete/i })).toBeInTheDocument()
  })

  test("Loading story では詳細領域にスケルトンを表示して操作導線を出さない", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        get: { durationOrMode: "infinite" },
      }),
      ...categoryHandlers,
    )

    render(<Loading />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })

    expect(await within(dialog).findByLabelText("loading payment details")).toBeInTheDocument()
    expect(await within(dialog).findAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(within(dialog).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /edit date/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /edit category/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /edit note/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /edit amount/i })).not.toBeInTheDocument()
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

  test("category 編集中は他フィールドの編集導線を無効化する", async () => {
    const { user } = render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit category/i }))

    expect(await within(dialog).findByRole("combobox", { name: /category/i })).toHaveTextContent(
      "Food",
    )
    expect(within(dialog).getByRole("button", { name: /edit date/i })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: /edit note/i })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: /edit amount/i })).toBeDisabled()
  })

  test("note 編集中は category の編集導線を無効化する", async () => {
    const { user } = render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit note/i }))

    expect(within(dialog).getByRole("button", { name: /edit category/i })).toBeDisabled()
  })

  test("category 編集中の Escape はオーバーレイを閉じずに編集だけ解除する", async () => {
    const { user } = render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit category/i }))
    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole("combobox", { name: /category/i })).not.toBeInTheDocument()
    expect(within(dialog).getByText("Food")).toBeInTheDocument()
  })

  test("category を None にすると未設定として保存して詳細表示も None になる", async () => {
    const { user } = render(<Default />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(await within(dialog).findByRole("button", { name: /edit category/i }))
    await user.click(await within(dialog).findByRole("combobox", { name: /category/i }))
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: [
          { ...mapPaymentToRow(payments[0]), category_id: null },
          ...payments.slice(1).map(mapPaymentToRow),
        ],
      }),
      ...categoryHandlers,
    )
    await user.click(await screen.findByRole("option", { name: /^none$/i }))

    await waitFor(() => {
      expect(within(dialog).queryByRole("combobox", { name: /category/i })).not.toBeInTheDocument()
    })
    expect(await within(dialog).findByText("None")).toBeInTheDocument()
    expect(within(dialog).queryByText("No category")).not.toBeInTheDocument()
    expect(within(dialog).queryByText("Unknown")).not.toBeInTheDocument()
  })

  describe("Date editing", () => {
    beforeEach(() => {
      vi.stubGlobal("jest", {
        advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
      })

      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-06-02T12:00:00+09:00"))
      setDefaultOptions({ locale: enUS })
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
      setDefaultOptions({ locale: ja })
    })

    test("Default story では日付編集ボタンも表示する", async () => {
      render(<Default />, { userOptions: { delay: null } })

      const dialog = await screen.findByRole("dialog", { name: /payment details/i })
      expect(await within(dialog).findByRole("button", { name: /edit date/i })).toBeInTheDocument()
    })

    test("date 編集中はカレンダーを開き、他フィールドの編集導線を無効化する", async () => {
      const { user } = render(<Default />, { userOptions: { delay: null } })

      const dialog = await screen.findByRole("dialog", { name: /payment details/i })
      await user.click(await within(dialog).findByRole("button", { name: /edit date/i }))

      expect(await screen.findByRole("button", { name: /today/i })).toBeInTheDocument()
      expect(within(dialog).getByRole("button", { name: /edit note/i })).toBeDisabled()
      expect(within(dialog).getByRole("button", { name: /edit amount/i })).toBeDisabled()
    })

    test("date 編集中の Escape はオーバーレイを閉じずに編集だけ解除する", async () => {
      const { user } = render(<Default />, { userOptions: { delay: null } })

      const dialog = await screen.findByRole("dialog", { name: /payment details/i })
      await user.click(await within(dialog).findByRole("button", { name: /edit date/i }))
      await user.click(within(dialog).getByRole("textbox", { name: /date/i }))
      await user.keyboard("{Escape}")

      expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
      expect(within(dialog).queryByRole("textbox", { name: /date/i })).not.toBeInTheDocument()
      expect(within(dialog).getByText("Jun 2, 2025")).toBeInTheDocument()
    })

    test("オーバーレイを閉じて再表示すると date の draft はリセットされる", async () => {
      const { user, rerender } = render(<Default />, { userOptions: { delay: null } })

      const dialog = await screen.findByRole("dialog", { name: /payment details/i })
      await user.click(await within(dialog).findByRole("button", { name: /edit date/i }))
      await user.click(within(dialog).getByRole("textbox", { name: /date/i }))

      rerender(<Default open={false} />)
      rerender(<Default open />)

      const reopenedDialog = await screen.findByRole("dialog", { name: /payment details/i })
      await user.click(await within(reopenedDialog).findByRole("button", { name: /edit date/i }))

      expect(within(reopenedDialog).getByRole("textbox", { name: /date/i })).toHaveValue(
        "Jun 2, 2025",
      )
    })
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
          book_id: 1,
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

import { composeStories } from "@storybook/react-vite"
import { setDefaultOptions } from "date-fns"
import { enUS, ja } from "date-fns/locale"
import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import { PaymentDateField } from "./PaymentDateField"
import * as stories from "./PaymentDateField.stories"

const { Default } = composeStories(stories)

beforeEach(() => {
  vi.stubGlobal("jest", {
    advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
  })

  vi.useFakeTimers()
  vi.setSystemTime(new Date("2025-06-02T12:00:00+09:00"))
  setDefaultOptions({ locale: enUS })
  server.resetHandlers(...createPaymentHandlers())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setDefaultOptions({ locale: ja })
})

describe("PaymentDetails PaymentDateField", () => {
  test("Default story ではラベルと日付と編集ボタンを表示する", () => {
    render(<Default />, { userOptions: { delay: null } })

    expect(screen.getByText("Date")).toBeInTheDocument()
    expect(screen.getByText("2025/06/02")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit date/i })).toBeInTheDocument()
  })

  test("編集ボタンを押すと日付入力欄とカレンダーを開く", async () => {
    const { user } = render(<Default />, { userOptions: { delay: null } })

    await user.click(screen.getByRole("button", { name: /edit date/i }))

    expect(screen.getByRole("textbox", { name: /date/i })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: /今日/i })).toBeInTheDocument()
  })

  test("日付を選ぶと保存して editor を閉じる", async () => {
    const { user } = render(<Default />, { userOptions: { delay: null } })

    await user.click(screen.getByRole("button", { name: /edit date/i }))
    await user.click(screen.getByRole("textbox", { name: /date/i }))
    await user.click(await screen.findByRole("button", { name: /2025年6月3日/ }))

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /date/i })).not.toBeInTheDocument()
    })
  })

  test("同日を再選択すると API は呼ばずに editor と popover が閉じる", async () => {
    let updateCalls = 0

    server.use(
      http.patch("*/rest/v1/payments*", async () => {
        updateCalls += 1
        return HttpResponse.json({ message: "Updated" })
      }),
    )

    const { user } = render(<Default />, { userOptions: { delay: null } })

    await user.click(screen.getByRole("button", { name: /edit date/i }))
    await user.click(screen.getByRole("textbox", { name: /date/i }))
    await user.click(await screen.findByRole("button", { name: /2025年6月2日/ }))

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /date/i })).not.toBeInTheDocument()
    })
    expect(updateCalls).toBe(0)
  })

  test("保存失敗時は編集状態を維持してエラーを表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { error: true },
      }),
    )

    const { user } = render(<Default />, { userOptions: { delay: null } })

    await user.click(screen.getByRole("button", { name: /edit date/i }))
    await user.click(screen.getByRole("textbox", { name: /date/i }))
    await user.click(await screen.findByRole("button", { name: /2025年6月3日/ }))

    expect(
      await screen.findByText("Failed to update date.", { selector: "span" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /date/i })).toBeInTheDocument()
  })

  test("保存中は日付入力欄を操作不可にする", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { durationOrMode: 1000 },
      }),
    )

    const { user } = render(<Default />, { userOptions: { delay: null } })

    await user.click(screen.getByRole("button", { name: /edit date/i }))
    await user.click(screen.getByRole("textbox", { name: /date/i }))
    await user.click(await screen.findByRole("button", { name: /2025年6月3日/ }))

    expect(screen.getByRole("textbox", { name: /date/i })).toBeDisabled()
  })

  test("Escape で編集を閉じると onEditEnd を呼ぶ", async () => {
    let editStartCalls = 0
    let editEndCalls = 0
    const onEditStart = () => {
      editStartCalls += 1
    }
    const onEditEnd = () => {
      editEndCalls += 1
    }
    const { user } = render(
      <PaymentDateField
        paymentId={1}
        date={new Date(2025, 5, 2)}
        onEditStart={onEditStart}
        onEditEnd={onEditEnd}
      />,
      {
        userOptions: { delay: null },
      },
    )

    await user.click(screen.getByRole("button", { name: /edit date/i }))
    await user.click(screen.getByRole("textbox", { name: /date/i }))
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /date/i })).not.toBeInTheDocument()
    })
    expect(editStartCalls).toBe(1)
    expect(editEndCalls).toBe(1)
  })
})

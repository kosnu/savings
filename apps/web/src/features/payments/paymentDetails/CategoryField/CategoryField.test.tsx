import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { categoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./CategoryField.stories"

const { Default, Unknown } = composeStories(stories)

describe("PaymentDetails CategoryField", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers(), ...categoryHandlers)
  })

  test("Default story ではラベルとカテゴリ名を表示する", () => {
    render(<Default />)

    expect(screen.getByText("Category")).toBeInTheDocument()
    expect(screen.getByText("Food")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit category/i })).toBeInTheDocument()
  })

  test("編集ボタンを押すと現在カテゴリを選択した combobox を表示する", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))

    expect(await screen.findByRole("combobox", { name: /category/i })).toHaveTextContent("Food")
  })

  test("カテゴリを選ぶと保存して editor を閉じる", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))
    await user.click(await screen.findByRole("combobox", { name: /category/i }))
    await user.click(await screen.findByRole("option", { name: /daily necessities/i }))

    await waitFor(() => {
      expect(screen.queryByRole("combobox", { name: /category/i })).not.toBeInTheDocument()
    })
  })

  test("None を選ぶとカテゴリ未設定として保存する", async () => {
    let updatePayload: unknown

    server.use(
      http.patch("*/rest/v1/payments*", async ({ request }) => {
        updatePayload = await request.json()
        return HttpResponse.json({ message: "Updated" })
      }),
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))
    await user.click(await screen.findByRole("combobox", { name: /category/i }))
    await user.click(await screen.findByRole("option", { name: /^none$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("combobox", { name: /category/i })).not.toBeInTheDocument()
    })
    expect(updatePayload).toEqual({ category_id: null })
    expect(screen.getByText("Food")).toBeInTheDocument()
  })

  test("未設定カテゴリの編集開始時は None を選択状態にする", async () => {
    const { user } = render(<Unknown />)

    expect(screen.getByText("Unknown")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /edit category/i }))

    expect(await screen.findByRole("combobox", { name: /category/i })).toHaveTextContent("None")
  })

  test("同じカテゴリを再選択すると API は呼ばずに editor を閉じる", async () => {
    let updateCalls = 0

    server.use(
      http.patch("*/rest/v1/payments*", () => {
        updateCalls += 1
        return HttpResponse.json({ message: "Updated" })
      }),
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))
    await user.click(await screen.findByRole("combobox", { name: /category/i }))
    await user.click(await screen.findByRole("option", { name: /^food$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("combobox", { name: /category/i })).not.toBeInTheDocument()
    })
    expect(updateCalls).toBe(0)
  })

  test("値を変えずにカテゴリメニューを閉じると API は呼ばずに editor を閉じる", async () => {
    let updateCalls = 0

    server.use(
      http.patch("*/rest/v1/payments*", () => {
        updateCalls += 1
        return HttpResponse.json({ message: "Updated" })
      }),
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))
    await user.click(await screen.findByRole("combobox", { name: /category/i }))
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("combobox", { name: /category/i })).not.toBeInTheDocument()
    })
    expect(updateCalls).toBe(0)
  })

  test("保存失敗時は編集状態を維持してエラーを表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { error: true },
      }),
      ...categoryHandlers,
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))
    await user.click(await screen.findByRole("combobox", { name: /category/i }))
    await user.click(await screen.findByRole("option", { name: /daily necessities/i }))

    expect(
      await screen.findByText("Failed to update category.", { selector: "span" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /category/i })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /category/i })).toHaveTextContent(
      "Daily Necessities",
    )
  })

  test("保存中は combobox を操作不可にする", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { durationOrMode: 1000 },
      }),
      ...categoryHandlers,
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))
    await user.click(await screen.findByRole("combobox", { name: /category/i }))
    await user.click(await screen.findByRole("option", { name: /daily necessities/i }))

    expect(screen.getByRole("combobox", { name: /category/i })).toBeDisabled()
  })

  test("Escape で編集を閉じると onEditEnd を呼ぶ", async () => {
    const onEditStart = vi.fn()
    const onEditEnd = vi.fn()
    const { user } = render(<Default onEditStart={onEditStart} onEditEnd={onEditEnd} />)

    await user.click(screen.getByRole("button", { name: /edit category/i }))
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("combobox", { name: /category/i })).not.toBeInTheDocument()
    expect(onEditStart).toHaveBeenCalledTimes(1)
    expect(onEditEnd).toHaveBeenCalledTimes(1)
  })
})

import { composeStories } from "@storybook/react-vite"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./NoteField.stories"

const { Default, EmptyNote } = composeStories(stories)

describe("PaymentDetails NoteField", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  test("Default story ではラベルとノートを表示する", () => {
    render(<Default />)

    expect(screen.getByText("Note")).toBeInTheDocument()
    expect(screen.getByText("コンビニ")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit note/i })).toBeInTheDocument()
  })

  test("EmptyNote story ではプレースホルダーを表示する", () => {
    render(<EmptyNote />)

    expect(screen.getByText("No note")).toBeInTheDocument()
  })

  test("編集ボタンを押すと入力欄を開く", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit note/i }))

    expect(screen.getByRole("textbox", { name: /note/i })).toBeInTheDocument()
  })

  test("Enter でノートを保存できる", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit note/i }))
    const noteInput = screen.getByRole("textbox", { name: /note/i })
    await user.clear(noteInput)
    await user.type(noteInput, "ドラッグストア{Enter}")

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /note/i })).not.toBeInTheDocument()
    })
  })

  test("編集中の Escape は編集だけ解除する", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit note/i }))
    const noteInput = screen.getByRole("textbox", { name: /note/i })
    await user.clear(noteInput)
    await user.type(noteInput, "ドラッグストア")
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("textbox", { name: /note/i })).not.toBeInTheDocument()
    expect(screen.getByText("コンビニ")).toBeInTheDocument()
  })

  test("保存失敗時は編集状態を維持してエラーを表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { error: true },
      }),
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit note/i }))
    const noteInput = screen.getByRole("textbox", { name: /note/i })
    await user.clear(noteInput)
    await user.type(noteInput, "ドラッグストア")
    await user.click(screen.getByRole("button", { name: /save note/i }))

    expect(
      await screen.findByText("Failed to update note.", { selector: "span" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /note/i })).toBeInTheDocument()
  })

  test("保存中は入力欄と保存ボタンを操作不可にする", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        update: { durationOrMode: 1000 },
      }),
    )

    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /edit note/i }))
    const noteInput = screen.getByRole("textbox", { name: /note/i })
    await user.clear(noteInput)
    await user.type(noteInput, "ドラッグストア")
    const saveButton = screen.getByRole("button", { name: /save note/i })
    await user.click(saveButton)

    expect(noteInput).toBeDisabled()
    expect(saveButton).toBeDisabled()
    expect(screen.getByLabelText("saving")).toBeInTheDocument()
  })

  test("未変更なら update を呼ばずに編集を閉じる", async () => {
    const onEditStart = vi.fn()
    const onEditEnd = vi.fn()
    const { user } = render(<Default onEditStart={onEditStart} onEditEnd={onEditEnd} />)

    await user.click(screen.getByRole("button", { name: /edit note/i }))
    await user.click(screen.getByRole("button", { name: /save note/i }))

    expect(screen.queryByRole("textbox", { name: /note/i })).not.toBeInTheDocument()
    expect(onEditStart).toHaveBeenCalledTimes(1)
    expect(onEditEnd).toHaveBeenCalledTimes(1)
  })

  test("Escape で編集を閉じると onEditEnd を呼ぶ", async () => {
    const onEditStart = vi.fn()
    const onEditEnd = vi.fn()
    const { user } = render(<Default onEditStart={onEditStart} onEditEnd={onEditEnd} />)

    await user.click(screen.getByRole("button", { name: /edit note/i }))
    await user.keyboard("{Escape}")

    expect(onEditStart).toHaveBeenCalledTimes(1)
    expect(onEditEnd).toHaveBeenCalledTimes(1)
  })
})

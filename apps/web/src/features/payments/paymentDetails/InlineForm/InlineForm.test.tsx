import { describe, expect, test, vi } from "vite-plus/test"

import { fireEvent, render, screen } from "../../../../test/test-utils"
import { InlineForm } from "./InlineForm"

describe("InlineForm", () => {
  test("children を描画する", () => {
    render(
      <InlineForm>
        <button type="button">Edit content</button>
      </InlineForm>,
      { withProviders: false },
    )

    expect(screen.getByRole("button", { name: "Edit content" })).toBeInTheDocument()
  })

  test("submit は既定の送信を抑えて onSubmit を呼ぶ", () => {
    const onSubmit = vi.fn()
    render(
      <InlineForm onSubmit={onSubmit}>
        <button type="submit">Save</button>
      </InlineForm>,
      { withProviders: false },
    )

    const form = screen.getByRole("button", { name: "Save" }).closest("form")
    expect(form).not.toBeNull()

    const submitEvent = new Event("submit", { bubbles: true, cancelable: true })
    fireEvent(form as HTMLFormElement, submitEvent)

    expect(submitEvent.defaultPrevented).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test("Escape で onCancel を呼ぶ", async () => {
    const onCancel = vi.fn()
    const { user } = render(
      <InlineForm onCancel={onCancel}>
        <input aria-label="Memo" />
      </InlineForm>,
      { withProviders: false },
    )

    await user.click(screen.getByRole("textbox", { name: "Memo" }))
    await user.keyboard("{Escape}")

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("saving 中の Escape では onCancel を呼ばない", async () => {
    const onCancel = vi.fn()
    const { user } = render(
      <InlineForm onCancel={onCancel} saving>
        <input aria-label="Memo" />
      </InlineForm>,
      { withProviders: false },
    )

    await user.click(screen.getByRole("textbox", { name: "Memo" }))
    await user.keyboard("{Escape}")

    expect(onCancel).not.toHaveBeenCalled()
  })
})

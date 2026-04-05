import { composeStories } from "@storybook/react-vite"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { fireEvent, render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./CreatePaymentModal.stories"

const { Default } = composeStories(stories)

async function fillAndSubmit(dialog: HTMLElement, body: ReturnType<typeof within>, note: string) {
  const categorySelect = within(dialog).getByRole("combobox", { name: /category/i })
  await userEvent.click(categorySelect)

  const listbox = await body.findByRole("listbox")
  await waitFor(() => {
    expect(within(listbox).queryByLabelText(/loading/)).not.toBeInTheDocument()
  })

  const categoryOption = await within(listbox).findByRole("option", {
    name: /food/i,
  })
  await userEvent.click(categoryOption)

  const amountInput = within(dialog).getByLabelText(/amount/i)
  await userEvent.type(amountInput, "1000")

  const noteInput = within(dialog).getByLabelText(/note/i)
  await userEvent.type(noteInput, note)

  await userEvent.click(within(dialog).getByRole("button", { name: /create/i }))
}

describe("CreatePaymentModal", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
  })

  test("should stay open when Escape is pressed", async () => {
    const user = userEvent.setup()

    render(<Default />)

    await user.click(screen.getByRole("button", { name: /create payment/i }))

    const dialog = await screen.findByRole("dialog", { name: /create payment/i })
    expect(dialog).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(screen.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()
  })

  test("トリガー操作でダイアログと amount 入力欄を表示する", async () => {
    const user = userEvent.setup()

    render(<Default />)

    await user.click(screen.getByRole("button", { name: /create payment/i }))

    const dialog = await screen.findByRole("dialog", { name: /create payment/i })
    expect(dialog).toBeInTheDocument()
    expect(await within(dialog).findByLabelText(/amount/i)).toBeInTheDocument()
  })

  test("should close when Cancel is clicked", async () => {
    const user = userEvent.setup()

    render(<Default />)

    await user.click(screen.getByRole("button", { name: /create payment/i }))
    await screen.findByRole("dialog", { name: /create payment/i })

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(screen.queryByRole("dialog", { name: /create payment/i })).not.toBeInTheDocument()
  })

  test("連続作成を有効にすると作成後もダイアログを開いたままにする", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()

    render(<Default onSuccess={onSuccess} />)

    await user.click(screen.getByRole("button", { name: /create payment/i }))

    const body = within(document.body)
    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    await within(dialog).findByLabelText(/amount/i)

    const checkbox = within(dialog).getByRole("checkbox", { name: /continue creating/i })
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    await fillAndSubmit(dialog, body, "Test payment")

    await waitFor(() => {
      expect(
        within(body.getByRole("dialog", { name: /create payment/i })).getByLabelText(/amount/i),
      ).toBeInTheDocument()
    })

    await waitFor(() => {
      const amountInputAfterSubmit = within(
        body.getByRole("dialog", { name: /create payment/i }),
      ).getByLabelText(/amount/i)
      expect(amountInputAfterSubmit).toHaveValue("")
    })

    const checkboxAfterSubmit = within(
      body.getByRole("dialog", { name: /create payment/i }),
    ).getByRole("checkbox", {
      name: /continue creating/i,
    })
    expect(checkboxAfterSubmit).toBeChecked()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  test("連続作成が未選択なら作成後に onSuccess が呼ばれる", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()

    render(<Default onSuccess={onSuccess} />)

    await user.click(screen.getByRole("button", { name: /create payment/i }))

    const body = within(document.body)
    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    await within(dialog).findByLabelText(/amount/i)

    const checkbox = within(dialog).getByRole("checkbox", { name: /continue creating/i })
    expect(checkbox).not.toBeChecked()

    await fillAndSubmit(dialog, body, "Test payment without continuous mode")

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })
})

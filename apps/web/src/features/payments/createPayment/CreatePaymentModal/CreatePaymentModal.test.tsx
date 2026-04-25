import { composeStories } from "@storybook/react-vite"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import {
  act,
  fireEvent,
  render,
  screen,
  type TestUser,
  waitFor,
  within,
} from "../../../../test/test-utils"
import * as stories from "./CreatePaymentModal.stories"

const { Default } = composeStories(stories)

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

async function openCreatePaymentModal() {
  await act(async () => {
    // user.click ではモーダル表示時の Suspense 更新が act 内で完了せず警告が出るため、
    // ここではクリックによる開閉だけを fireEvent で同期的に発火する。
    fireEvent.click(screen.getByRole("button", { name: /create payment/i }))
  })

  return await screen.findByRole("dialog", { name: /create payment/i })
}

async function fillAndSubmit(
  user: TestUser,
  dialog: HTMLElement,
  body: ReturnType<typeof within>,
  note: string,
) {
  const categorySelect = within(dialog).getByRole("combobox", { name: /category/i })
  await user.click(categorySelect)

  const listbox = await body.findByRole("listbox")
  await waitFor(() => {
    expect(within(listbox).queryByRole("option", { name: /loading/i })).not.toBeInTheDocument()
  })

  const categoryOption = await within(listbox).findByRole("option", {
    name: /food/i,
  })
  await user.click(categoryOption)

  const amountInput = within(dialog).getByLabelText(/amount/i)
  await user.type(amountInput, "1000")

  const noteInput = within(dialog).getByLabelText(/note/i)
  await user.type(noteInput, note)

  await user.click(within(dialog).getByRole("button", { name: /create/i }))
}

describe("CreatePaymentModal", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
  })

  test("should stay open when Escape is pressed", async () => {
    const { user, baseElement } = await renderStory(<Default />)

    const dialog = await openCreatePaymentModal()
    expect(dialog).toBeInTheDocument()

    fireEvent.pointerDown(baseElement) // モーダルの外をクリックするために baseElement をクリック
    fireEvent.click(baseElement) // モーダルの外をクリックするために baseElement をクリック

    expect(screen.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()
    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()
  })

  test("トリガー操作でダイアログと amount 入力欄を表示する", async () => {
    await renderStory(<Default />)

    const dialog = await openCreatePaymentModal()
    expect(dialog).toBeInTheDocument()
    expect(await within(dialog).findByLabelText(/amount/i)).toBeInTheDocument()
  })

  test("should close when Cancel is clicked", async () => {
    const { user } = await renderStory(<Default />)

    await openCreatePaymentModal()

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(screen.queryByRole("dialog", { name: /create payment/i })).not.toBeInTheDocument()
  })

  test("連続作成を有効にすると作成後もダイアログを開いたままにする", async () => {
    const onSuccess = vi.fn()

    const { user, baseElement } = await renderStory(<Default onSuccess={onSuccess} />)

    const body = within(baseElement)
    const dialog = await openCreatePaymentModal()
    await within(dialog).findByLabelText(/amount/i)

    const checkbox = within(dialog).getByRole("checkbox", { name: /continue creating/i })
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    await fillAndSubmit(user, dialog, body, "Test payment")

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
    const onSuccess = vi.fn()

    const { user, baseElement } = await renderStory(<Default onSuccess={onSuccess} />)

    const body = within(baseElement)
    const dialog = await openCreatePaymentModal()
    await within(dialog).findByLabelText(/amount/i)

    const checkbox = within(dialog).getByRole("checkbox", { name: /continue creating/i })
    expect(checkbox).not.toBeChecked()

    await fillAndSubmit(user, dialog, body, "Test payment without continuous mode")

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })
})

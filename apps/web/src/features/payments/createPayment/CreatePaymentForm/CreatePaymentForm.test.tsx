import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { act, render, screen, type TestUser, waitFor, within } from "../../../../test/test-utils"
import { createDeferred } from "../../../../test/utils/createDeferred"
import { PAYMENT_NOTE_MAX_LENGTH } from "../../paymentFormSchema"
import * as stories from "./CreatePaymentForm.stories"

const { Default } = composeStories(stories)
const PAYMENTS_REST_URL = "*/rest/v1/payments*"

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

async function selectFoodCategory(user: TestUser) {
  const categorySelect = await screen.findByRole("combobox", { name: /category/i })
  await user.click(categorySelect)

  const listbox = await within(document.body).findByRole("listbox")
  await waitFor(() => {
    expect(within(listbox).queryByRole("option", { name: /loading/i })).not.toBeInTheDocument()
  })

  const option = await within(listbox).findByRole("option", { name: /food/i })
  await user.click(option)
}

describe("CreatePaymentForm", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
  })

  test("Default story では amount 入力欄に自動フォーカスする", async () => {
    await renderStory(<Default />)

    const amountField = await screen.findByRole("textbox", { name: /amount/i })
    expect(document.activeElement).toBe(amountField)
  })

  test("カテゴリの非同期読み込み後に入力を進められる", async () => {
    const { user } = await renderStory(<Default />)

    await user.click(await screen.findByRole("textbox", { name: /date/i }))
    await selectFoodCategory(user)

    const noteInput = screen.getByRole("textbox", { name: /note/i })
    await user.type(noteInput, "Test_FSf5qxLNxAC265uSTcNa")

    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.type(amountInput, "1080")

    expect(screen.getByRole("combobox", { name: /category/i })).toHaveTextContent("Food")
    expect(noteInput).toHaveValue("Test_FSf5qxLNxAC265uSTcNa")
    expect(amountInput).toHaveValue("1080")
  })

  test("amount 未入力で送信するとバリデーションエラーを表示する", async () => {
    const { user } = await renderStory(<Default />)

    await user.click(screen.getByRole("button", { name: /create/i }))

    expect(await screen.findByText("Amount cannot be empty")).toBeInTheDocument()
  })

  test("amount が不正な文字列の場合は作成せずにエラーを表示する", async () => {
    const onSuccess = vi.fn()
    let requestCount = 0

    server.resetHandlers(
      ...createCategoryHandlers(),
      http.post(PAYMENTS_REST_URL, () => {
        requestCount += 1
        return HttpResponse.json([{ id: 999 }], { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /amount/i }), "invalid")
    await user.click(screen.getByRole("button", { name: /create/i }))

    expect(await screen.findByText("Amount must be a number")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(requestCount).toBe(0)
  })

  test("note が30文字を超えると作成せずにエラーを表示する", async () => {
    const onSuccess = vi.fn()

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /amount/i }), "1080")
    await user.type(
      screen.getByRole("textbox", { name: /note/i }),
      "a".repeat(PAYMENT_NOTE_MAX_LENGTH + 1),
    )
    await user.click(screen.getByRole("button", { name: /create/i }))

    expect(
      await screen.findByText(`Note must be ${PAYMENT_NOTE_MAX_LENGTH} characters or less`),
    ).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("category と note が空でも作成できる", async () => {
    const onSuccess = vi.fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      ...createCategoryHandlers(),
      http.post(PAYMENTS_REST_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json([{ id: 999, ...requestBody }], { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /amount/i }), "1080")
    await user.click(screen.getByRole("button", { name: /create/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    expect(requestBody).toMatchObject({
      amount: 1080,
      category_id: null,
      note: null,
    })
    expect(requestBody).not.toHaveProperty("user_id")
    expect(requestBody).not.toHaveProperty("book_id")
    expect(requestBody?.date).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  test("有効な入力では選択カテゴリを含む payload で作成する", async () => {
    const onSuccess = vi.fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      ...createCategoryHandlers(),
      http.post(PAYMENTS_REST_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json([{ id: 1000, ...requestBody }], { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await selectFoodCategory(user)
    await user.type(screen.getByRole("textbox", { name: /note/i }), "dinner")
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "1080")

    await user.click(screen.getByRole("button", { name: /create/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    expect(requestBody).toMatchObject({
      amount: 1080,
      category_id: 10,
      note: "dinner",
    })
    expect(requestBody).not.toHaveProperty("user_id")
    expect(requestBody).not.toHaveProperty("book_id")
    expect(requestBody?.date).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  test("支払い作成中は作成ボタンをローディング表示し操作ボタンを無効化する", async () => {
    const paymentCreated = createDeferred()

    server.resetHandlers(
      ...createCategoryHandlers(),
      http.post(PAYMENTS_REST_URL, async () => {
        await paymentCreated.promise
        return HttpResponse.json([{ id: 1001 }], { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default />)

    await user.type(screen.getByRole("textbox", { name: /amount/i }), "1080")
    await user.click(screen.getByRole("button", { name: /create/i }))

    const createButton = await screen.findByRole("button", { name: /create/i })
    expect(await within(createButton).findByLabelText("loading-spinner")).toBeInTheDocument()
    expect(createButton).toBeDisabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled()

    await act(async () => {
      paymentCreated.resolve()
    })

    await waitFor(() => {
      expect(within(createButton).queryByLabelText("loading-spinner")).not.toBeInTheDocument()
    })
    expect(createButton).toBeEnabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled()
  })

  test("支払い作成に失敗するとonErrorを呼んで操作ボタンを再度有効化する", async () => {
    const onError = vi.fn()

    server.resetHandlers(
      ...createCategoryHandlers(),
      ...createPaymentHandlers({ create: { error: true } }),
    )

    const { user } = await renderStory(<Default onError={onError} />)

    await user.type(screen.getByRole("textbox", { name: /amount/i }), "1080")
    await user.click(screen.getByRole("button", { name: /create/i }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole("button", { name: /create/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled()
  })
})

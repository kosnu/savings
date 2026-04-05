import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, type TestUser, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./CreatePaymentForm.stories"

const { Default } = composeStories(stories)
const PAYMENTS_REST_URL = "*/rest/v1/payments*"

function renderStory(story: React.ReactElement) {
  return render(story)
}

async function selectFoodCategory(user: TestUser) {
  const categorySelect = await screen.findByRole("combobox", { name: /category/i })
  await user.click(categorySelect)

  const listbox = await within(document.body).findByRole("listbox")
  await waitFor(() => {
    expect(within(listbox).queryByLabelText(/loading/i)).not.toBeInTheDocument()
  })

  const option = await within(listbox).findByRole("option", { name: /food/i })
  await user.click(option)
}

describe("CreatePaymentForm", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
  })

  test("Default story では amount 入力欄に自動フォーカスする", async () => {
    renderStory(<Default />)

    const amountField = await screen.findByRole("textbox", { name: /amount/i })
    expect(document.activeElement).toBe(amountField)
  })

  test("カテゴリの非同期読み込み後に入力を進められる", async () => {
    const { user } = renderStory(<Default />)

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
    const { user } = renderStory(<Default />)

    await user.click(screen.getByRole("button", { name: /create/i }))

    expect(await screen.findByText("Amount cannot be empty")).toBeInTheDocument()
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

    const { user } = renderStory(<Default onSuccess={onSuccess} />)

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

    const { user } = renderStory(<Default onSuccess={onSuccess} />)

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
    expect(requestBody?.date).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })
})

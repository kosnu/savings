import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { server } from "../../../../test/msw/server"
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test/test-utils"
import { fillCreateCategoryBudgetForm } from "../../test/utils/budgetCreationForm"
import * as stories from "./CreateCategoryBudgetModal.stories"

const { Default } = composeStories(stories)
const CATEGORY_BUDGETS_REST_URL = "*/rest/v1/category_budgets*"
const { mockCaptureCategoryBudgetCreateError } = vi.hoisted(() => ({
  mockCaptureCategoryBudgetCreateError: vi.fn(),
}))

vi.mock("../../../../lib/sentry", () => ({
  captureCategoryBudgetCreateError: mockCaptureCategoryBudgetCreateError,
}))

afterEach(() => {
  vi.restoreAllMocks()
  mockCaptureCategoryBudgetCreateError.mockReset()
})

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("CreateCategoryBudgetModal", () => {
  test("トリガー操作でダイアログと入力欄を表示する", async () => {
    await renderStory(<Default />)

    const dialog = await openCreateCategoryBudgetModal()

    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText("Set a category budget amount.")).toBeInTheDocument()
    expect(within(dialog).getByRole("combobox", { name: /category/i })).toBeInTheDocument()
    expect(within(dialog).getByRole("combobox", { name: "Month" })).toBeInTheDocument()
    expect(within(dialog).getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("Cancelをクリックするとダイアログを閉じる", async () => {
    const { user } = await renderStory(<Default />)

    await openCreateCategoryBudgetModal()
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog", { name: "Create category budget" })).not.toBeInTheDocument()
  })

  test("作成成功後にダイアログを閉じる", async () => {
    server.resetHandlers(
      ...createCategoryHandlers(),
      http.post(CATEGORY_BUDGETS_REST_URL, async ({ request }) => {
        const requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json([{ id: 999, ...requestBody }], { status: 201 })
      }),
    )
    const { user, baseElement } = await renderStory(<Default />)

    const body = within(baseElement)
    const dialog = await openCreateCategoryBudgetModal()

    await fillCreateCategoryBudgetForm({
      user,
      categoryName: "Food",
      year: "2026",
      month: "3",
      amount: "50000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create category budget" }),
      ).not.toBeInTheDocument()
    })
  })

  test("作成失敗時はダイアログを閉じない", async () => {
    server.resetHandlers(
      ...createCategoryHandlers(),
      http.post(CATEGORY_BUDGETS_REST_URL, () => {
        return HttpResponse.json({ message: "Failed to create category budget." }, { status: 500 })
      }),
    )
    const { user, baseElement } = await renderStory(<Default />)

    const body = within(baseElement)
    const dialog = await openCreateCategoryBudgetModal()

    await fillCreateCategoryBudgetForm({
      user,
      categoryName: "Food",
      year: "2026",
      month: "3",
      amount: "50000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mockCaptureCategoryBudgetCreateError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to create category budget." }),
      )
    })
    expect(await within(dialog).findByText("Failed to create category budget.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create category budget" })).toBeInTheDocument()
  })
})

async function openCreateCategoryBudgetModal() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create category budget" }))
  })

  return await screen.findByRole("dialog", { name: "Create category budget" })
}

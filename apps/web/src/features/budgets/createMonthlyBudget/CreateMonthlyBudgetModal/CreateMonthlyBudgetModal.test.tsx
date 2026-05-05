import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { server } from "../../../../test/msw/server"
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../../utils/postgresError"
import { fillCreateMonthlyBudgetForm } from "../../test/utils/budgetCreationForm"
import * as stories from "./CreateMonthlyBudgetModal.stories"

const { Default } = composeStories(stories)
const MONTHLY_BUDGETS_REST_URL = "*/rest/v1/monthly_budgets*"
const { mockCaptureMonthlyBudgetCreateError } = vi.hoisted(() => ({
  mockCaptureMonthlyBudgetCreateError: vi.fn(),
}))

vi.mock("../../../../lib/sentry", () => ({
  captureMonthlyBudgetCreateError: mockCaptureMonthlyBudgetCreateError,
}))

afterEach(() => {
  vi.restoreAllMocks()
  mockCaptureMonthlyBudgetCreateError.mockReset()
})

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

async function openCreateMonthlyBudgetModal() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }))
  })

  return await screen.findByRole("dialog", { name: "Create monthly budget" })
}

describe("CreateMonthlyBudgetModal", () => {
  test("トリガー操作で英語のダイアログと入力欄を表示する", async () => {
    await renderStory(<Default />)

    const dialog = await openCreateMonthlyBudgetModal()

    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText("Set a monthly budget amount.")).toBeInTheDocument()
    expect(within(dialog).getByRole("combobox", { name: "Month" })).toBeInTheDocument()
    expect(within(dialog).getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("Cancelをクリックするとダイアログを閉じる", async () => {
    const { user } = await renderStory(<Default />)

    await openCreateMonthlyBudgetModal()
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog", { name: "Create monthly budget" })).not.toBeInTheDocument()
  })

  test("作成成功後にダイアログを閉じる", async () => {
    server.resetHandlers(
      http.post(MONTHLY_BUDGETS_REST_URL, async ({ request }) => {
        const requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json([{ id: 999, ...requestBody }], { status: 201 })
      }),
    )
    const { user, baseElement } = await renderStory(<Default />)

    const body = within(baseElement)
    const dialog = await openCreateMonthlyBudgetModal()

    await fillCreateMonthlyBudgetForm({
      user,
      year: "2026",
      month: "3",
      amount: "300000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create monthly budget" }),
      ).not.toBeInTheDocument()
    })
  })

  test("作成失敗時はダイアログを閉じない", async () => {
    server.resetHandlers(
      http.post(MONTHLY_BUDGETS_REST_URL, () => {
        return HttpResponse.json({ message: "Failed to create monthly budget." }, { status: 500 })
      }),
    )
    const { user, baseElement } = await renderStory(<Default />)

    const body = within(baseElement)
    const dialog = await openCreateMonthlyBudgetModal()

    await fillCreateMonthlyBudgetForm({
      user,
      year: "2026",
      month: "3",
      amount: "300000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mockCaptureMonthlyBudgetCreateError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to create monthly budget." }),
      )
    })
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
    expect(within(dialog).getByText("Failed to create monthly budget.")).toBeInTheDocument()
  })

  test("重複年月エラー時はメッセージを表示してダイアログを閉じない", async () => {
    server.resetHandlers(
      http.post(MONTHLY_BUDGETS_REST_URL, () => {
        return HttpResponse.json(
          {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
          { status: 500 },
        )
      }),
    )
    const { user, baseElement } = await renderStory(<Default />)

    const body = within(baseElement)
    const dialog = await openCreateMonthlyBudgetModal()

    await fillCreateMonthlyBudgetForm({
      user,
      year: "2026",
      month: "3",
      amount: "300000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(
      await within(dialog).findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()
    expect(mockCaptureMonthlyBudgetCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ code: POSTGRES_UNIQUE_VIOLATION_CODE }),
    )
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
  })
})

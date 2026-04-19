import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { afterEach, describe, expect, test, vi } from "vitest"

import { server } from "../../../../test/msw/server"
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./CreateMonthlyBudgetModal.stories"

const { Default } = composeStories(stories)
const MONTHLY_BUDGETS_REST_URL = "*/rest/v1/monthly_budgets*"

afterEach(() => {
  vi.restoreAllMocks()
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

async function selectMonth(
  user: ReturnType<typeof render>["user"],
  dialog: HTMLElement,
  body: ReturnType<typeof within>,
) {
  await user.click(within(dialog).getByRole("combobox", { name: "Year" }))
  await user.click(await body.findByRole("option", { name: "2026" }))

  await user.click(within(dialog).getByRole("combobox", { name: "Month" }))
  await user.click(await body.findByRole("option", { name: "3" }))
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

    await selectMonth(user, dialog, body)
    await user.type(within(dialog).getByRole("textbox", { name: /amount/i }), "300000")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create monthly budget" }),
      ).not.toBeInTheDocument()
    })
  })

  test("作成失敗時はダイアログを閉じない", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      http.post(MONTHLY_BUDGETS_REST_URL, () => {
        return HttpResponse.json({ message: "Failed to create monthly budget." }, { status: 500 })
      }),
    )
    const { user, baseElement } = await renderStory(<Default />)

    const body = within(baseElement)
    const dialog = await openCreateMonthlyBudgetModal()

    await selectMonth(user, dialog, body)
    await user.type(within(dialog).getByRole("textbox", { name: /amount/i }), "300000")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error creating monthly budget:",
        expect.objectContaining({ message: "Failed to create monthly budget." }),
      )
    })
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
  })
})

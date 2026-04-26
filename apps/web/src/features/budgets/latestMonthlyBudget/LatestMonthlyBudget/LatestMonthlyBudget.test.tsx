import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../createMonthlyBudget/monthlyBudgetCreateError"
import * as stories from "./LatestMonthlyBudget.stories"

const { Default, Empty, FetchError, Loading } = composeStories(stories)

async function renderLatestMonthlyBudget(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

async function fillCreateMonthlyBudgetForm(
  user: ReturnType<typeof render>["user"],
  dialog: HTMLElement,
  body: ReturnType<typeof within>,
) {
  await user.click(within(dialog).getByRole("combobox", { name: "Year" }))
  await user.click(await body.findByRole("option", { name: "2026" }))
  await user.click(within(dialog).getByRole("combobox", { name: "Month" }))
  await user.click(await body.findByRole("option", { name: "3" }))
  await user.type(within(dialog).getByRole("textbox", { name: /amount/i }), "300000")
}

describe("LatestMonthlyBudget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("最新の月予算だけを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [monthlyBudgets[3], monthlyBudgets[2]] },
      }),
    )

    await renderLatestMonthlyBudget(<Default />)

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByText("￥75,000")).toBeInTheDocument()
    expect(screen.queryByText("￥62,000")).not.toBeInTheDocument()
  })

  test("月予算がない場合は作成導線を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
      }),
    )

    await renderLatestMonthlyBudget(<Empty />)

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
  })

  test("作成成功後に最新の月予算として表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
      }),
    )

    const { user, baseElement } = await renderLatestMonthlyBudget(<Empty />)

    await user.click(await screen.findByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm(user, dialog, body)
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create monthly budget" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText("￥300,000")).toBeInTheDocument()
  })

  test("作成失敗時は既存のエラー表示を維持する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
        create: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
    )

    const { user, baseElement } = await renderLatestMonthlyBudget(<Empty />)

    await user.click(await screen.findByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm(user, dialog, body)
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(
      await within(dialog).findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
  })

  test("取得中はスケルトンを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [], durationOrMode: "infinite" },
      }),
    )

    await renderLatestMonthlyBudget(<Loading />)

    expect(await screen.findByLabelText("loading latest monthly budget")).toBeInTheDocument()
  })

  test("取得に失敗した場合はエラー状態を表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { error: true },
      }),
    )

    await renderLatestMonthlyBudget(<FetchError />)

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      "Could not load monthly budgets.",
    )
  })
})

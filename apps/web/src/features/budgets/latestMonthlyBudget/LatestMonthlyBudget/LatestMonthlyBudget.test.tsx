import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import type { ReactElement } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../../utils/postgresError"
import {
  fillCreateMonthlyBudgetForm,
  getCurrentBudgetMonth,
} from "../../test/utils/budgetCreationForm"
import * as stories from "./LatestMonthlyBudget.stories"

const { Default, Empty, FetchError, Loading, OutOfRange } = composeStories(stories)
const currentBudgetMonth = getCurrentBudgetMonth()
const createdMonthlyBudget = {
  id: 999,
  book_id: 1,
  amount: 300000,
  created_at: `${currentBudgetMonth.effectiveFrom}T00:00:00.000Z`,
  effective_from: currentBudgetMonth.effectiveFrom,
  effective_month: currentBudgetMonth.monthNumber,
  effective_year: currentBudgetMonth.yearNumber,
  status: "amount" as const,
  updated_at: `${currentBudgetMonth.effectiveFrom}T00:00:00.000Z`,
}

async function renderLatestMonthlyBudget(story: ReactElement) {
  return await act(async () => {
    return render(story, { userOptions: { delay: null } })
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("LatestMonthlyBudget", () => {
  test("最新の月予算だけを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
      }),
    )

    await renderLatestMonthlyBudget(<Default />)

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByText("¥75,000")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Edit budget" })).toBeInTheDocument()
    expect(screen.queryByText("¥62,000")).not.toBeInTheDocument()
  })

  test("月予算がない場合は作成導線を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
      }),
    )

    await renderLatestMonthlyBudget(<Empty />)

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
  })

  test.each([
    [new Date(2026, 2, 20), "2026-03-01"],
    [new Date(2022, 0, 1), "2022-01-01"],
    [new Date(2032, 11, 31), "2032-12-01"],
  ])("現在日付が%sのときは許容範囲内の対象月%sの最新予算を読む", async (now, targetMonth) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)
    let requestBody: unknown
    server.use(
      http.post("*/rest/v1/rpc/get_effective_monthly_budget", async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({ status: "unset", monthly_budget: null })
      }),
    )

    await renderLatestMonthlyBudget(<Empty />)

    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
    expect(requestBody).toEqual({ p_target_month: targetMonth })
  })

  test.each([new Date(2021, 11, 31), new Date(2033, 0, 1)])(
    "現在日付が範囲外の%sのときは予算を読まず操作を表示しない",
    async (now) => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(now)
      const rpcRequest = vi.fn()
      server.use(
        http.post("*/rest/v1/rpc/*", () => {
          rpcRequest()
          return HttpResponse.json(null)
        }),
      )

      await renderLatestMonthlyBudget(<OutOfRange />)

      expect(screen.getByRole("alert")).toHaveTextContent("2022-01-01")
      expect(screen.getByRole("alert")).toHaveTextContent("2032-12-31")
      expect(screen.queryByRole("button", { name: "Create budget" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Edit budget" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Remove budget" })).not.toBeInTheDocument()
      expect(rpcRequest).not.toHaveBeenCalled()
    },
  )

  test("作成成功後に最新の月予算として表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
      }),
    )

    const { user, baseElement } = await renderLatestMonthlyBudget(<Empty />)

    await user.click(await screen.findByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: createdMonthlyBudget },
      }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create monthly budget" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText("¥300,000")).toBeInTheDocument()
  })

  test("作成失敗時は既存のエラー表示を維持する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
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

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(
      await within(dialog).findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
  })

  test("編集成功後に最新の月予算表示を更新する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
        update: { allowedMonthlyBudgetId: monthlyBudgets[3].id },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Edit budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit monthly budget" })
    const amountInput = within(dialog).getByRole("textbox", { name: /amount/i })

    expect(within(dialog).getByText("Update this month's budget amount.")).toBeInTheDocument()
    expect(within(dialog).getByText("This month")).toBeInTheDocument()
    expect(amountInput).toHaveValue("75000")

    await user.clear(amountInput)
    await user.type(amountInput, "82000")
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[3], amount: 82000 } },
        update: { allowedMonthlyBudgetId: monthlyBudgets[3].id },
      }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit monthly budget" })).not.toBeInTheDocument()
    })
    expect(await screen.findByText("¥82,000")).toBeInTheDocument()
    expect(screen.queryByText("¥75,000")).not.toBeInTheDocument()
  })

  test("編集失敗時はエラー表示を維持してダイアログを閉じない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
        update: { allowedMonthlyBudgetId: monthlyBudgets[3].id, error: true },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Edit budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit monthly budget" })
    const amountInput = within(dialog).getByRole("textbox", { name: /amount/i })

    await user.clear(amountInput)
    await user.type(amountInput, "82000")
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await within(dialog).findByText("Failed to update monthly budget.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Edit monthly budget" })).toBeInTheDocument()
    expect(screen.getByText("¥75,000")).toBeInTheDocument()
  })

  test("削除成功後は予算なしとして作成導線を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
        remove: { allowedMonthlyBudgetId: monthlyBudgets[3].id },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Remove budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Remove this month's budget?" })

    expect(
      within(dialog).getByText(
        "This month and future months will have no budget until you create a new one. Past months keep their budget history.",
      ),
    ).toBeInTheDocument()

    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: { status: "none", monthly_budget: null } },
        remove: { allowedMonthlyBudgetId: monthlyBudgets[3].id },
      }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Remove this month's budget?" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
    expect(screen.queryByText("¥75,000")).not.toBeInTheDocument()
  })

  test("削除失敗時はエラー表示を維持してダイアログを閉じない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
        remove: { allowedMonthlyBudgetId: monthlyBudgets[3].id, error: true },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Remove budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Remove this month's budget?" })

    await user.click(within(dialog).getByRole("button", { name: "Remove" }))

    expect(await within(dialog).findByText("Failed to remove monthly budget.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Remove this month's budget?" })).toBeInTheDocument()
    expect(screen.getByText("¥75,000")).toBeInTheDocument()
  })

  test("取得中はスケルトンを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null, durationOrMode: "infinite" },
      }),
    )

    await renderLatestMonthlyBudget(<Loading />)

    expect(await screen.findByLabelText("loading latest monthly budget")).toBeInTheDocument()
  })

  test("取得に失敗した場合はエラー状態を表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { error: true },
      }),
    )

    await renderLatestMonthlyBudget(<FetchError />)

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      "Could not load monthly budgets.",
    )
  })
})

test("更新対象IDが許可対象と異なる場合は失敗する", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  server.resetHandlers(
    ...createMonthlyBudgetHandlers({
      get: { response: monthlyBudgets[3] },
      update: { allowedMonthlyBudgetId: monthlyBudgets[2].id },
    }),
  )

  const { user } = await renderLatestMonthlyBudget(<Default />)

  await user.click(await screen.findByRole("button", { name: "Edit budget" }))
  const dialog = await screen.findByRole("dialog", { name: "Edit monthly budget" })
  await user.click(within(dialog).getByRole("button", { name: "Save" }))

  expect(await within(dialog).findByText("Failed to update monthly budget.")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Edit monthly budget" })).toBeInTheDocument()
})

test("更新の許可対象IDを省略した場合は失敗する", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  server.resetHandlers(
    ...createMonthlyBudgetHandlers({
      get: { response: monthlyBudgets[3] },
      // @ts-expect-error 許可対象IDの省略を実行時に検証する。
      update: {},
    }),
  )

  const { user } = await renderLatestMonthlyBudget(<Default />)

  await user.click(await screen.findByRole("button", { name: "Edit budget" }))
  const dialog = await screen.findByRole("dialog", { name: "Edit monthly budget" })
  await user.click(within(dialog).getByRole("button", { name: "Save" }))

  expect(await within(dialog).findByText("Failed to update monthly budget.")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Edit monthly budget" })).toBeInTheDocument()
})

test("削除対象IDが許可対象と異なる場合は失敗する", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  server.resetHandlers(
    ...createMonthlyBudgetHandlers({
      get: { response: monthlyBudgets[3] },
      remove: { allowedMonthlyBudgetId: monthlyBudgets[2].id },
    }),
  )

  const { user } = await renderLatestMonthlyBudget(<Default />)

  await user.click(await screen.findByRole("button", { name: "Remove budget" }))
  const dialog = await screen.findByRole("dialog", { name: "Remove this month's budget?" })
  await user.click(within(dialog).getByRole("button", { name: "Remove" }))

  expect(await within(dialog).findByText("Failed to remove monthly budget.")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Remove this month's budget?" })).toBeInTheDocument()
})

test("削除の許可対象IDを省略した場合は失敗する", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  server.resetHandlers(
    ...createMonthlyBudgetHandlers({
      get: { response: monthlyBudgets[3] },
      // @ts-expect-error 許可対象IDの省略を実行時に検証する。
      remove: {},
    }),
  )

  const { user } = await renderLatestMonthlyBudget(<Default />)

  await user.click(await screen.findByRole("button", { name: "Remove budget" }))
  const dialog = await screen.findByRole("dialog", { name: "Remove this month's budget?" })
  await user.click(within(dialog).getByRole("button", { name: "Remove" }))

  expect(await within(dialog).findByText("Failed to remove monthly budget.")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Remove this month's budget?" })).toBeInTheDocument()
})

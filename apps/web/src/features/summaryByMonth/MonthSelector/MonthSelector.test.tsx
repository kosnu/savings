import { createRoute } from "@tanstack/react-router"
import { describe, expect, test } from "vite-plus/test"

import { renderWithRouter as renderWithTestRouter } from "../../../test/helpers/renderWithRouter"
import { screen, waitFor } from "../../../test/test-utils"
import { paymentsSearchSchema } from "../../payments"
import { MonthSelector } from "./MonthSelector"

function renderMonthSelector(initialEntry: string) {
  window.history.replaceState({}, "", initialEntry)

  return renderWithTestRouter(initialEntry, (root) => {
    const authenticatedRoute = createRoute({
      getParentRoute: () => root,
      id: "authenticated",
    })

    const paymentsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/payments",
      component: MonthSelector,
      validateSearch: paymentsSearchSchema,
    })

    return [authenticatedRoute.addChildren([paymentsRoute])]
  })
}

function expectPaymentsSearch(
  search: unknown,
  expected: { category?: string; month: string; year: string },
) {
  const { year, month, category } = search as {
    category?: string
    month?: string
    year?: string
  }
  expect(year).toBe(expected.year)
  expect(month).toBe(expected.month)
  expect(category).toBe(expected.category)
}

describe("MonthSelector", () => {
  test("クエリパラメータがある場合、その年月が表示される", async () => {
    renderMonthSelector("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(screen.getByText("May")).toBeInTheDocument()
      expect(screen.getByText("2025")).toBeInTheDocument()
    })
  })

  test("年月を選択すると、クエリパラメータが更新される", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(screen.getByText("May")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("combobox", { name: "Month" }))

    const juneOption = await screen.findByRole("option", { name: "June" })
    await user.click(juneOption)

    await waitFor(() => {
      const { year, month } = router.state.location.search as {
        year?: string
        month?: string
      }
      expect(year).toBe("2025")
      expect(month).toBe("6")
    })
  })

  test("年月を選択してもカテゴリ条件を保持する", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5&category=10")

    await waitFor(() => {
      expect(screen.getByText("May")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("combobox", { name: "Month" }))

    const juneOption = await screen.findByRole("option", { name: "June" })
    await user.click(juneOption)

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2025",
        month: "6",
        category: "10",
      })
    })
  })

  test("前月を選択すると、クエリパラメータが1か月前に更新される", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5")

    await user.click(await screen.findByRole("button", { name: "Previous month" }))

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2025",
        month: "4",
      })
    })
  })

  test("下限月では前月を選択できず、クエリパラメータを更新しない", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2022&month=1")

    const previousMonthButton = await screen.findByRole("button", { name: "Previous month" })

    expect(previousMonthButton).toBeDisabled()

    await user.click(previousMonthButton)

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2022",
        month: "1",
      })
    })
  })

  test("1月から前月を選択すると、前年12月に更新される", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2026&month=1")

    await user.click(await screen.findByRole("button", { name: "Previous month" }))

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2025",
        month: "12",
      })
    })
  })

  test("翌月を選択すると、クエリパラメータが1か月後に更新される", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5")

    await user.click(await screen.findByRole("button", { name: "Next month" }))

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2025",
        month: "6",
      })
    })
  })

  test("上限月では翌月を選択できず、クエリパラメータを更新しない", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2032&month=12")

    const nextMonthButton = await screen.findByRole("button", { name: "Next month" })

    expect(nextMonthButton).toBeDisabled()

    await user.click(nextMonthButton)

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2032",
        month: "12",
      })
    })
  })

  test("12月から翌月を選択すると、翌年1月に更新される", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=12")

    await user.click(await screen.findByRole("button", { name: "Next month" }))

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2026",
        month: "1",
      })
    })
  })

  test("前月を選択してもカテゴリ条件を保持する", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5&category=10")

    await user.click(await screen.findByRole("button", { name: "Previous month" }))

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2025",
        month: "4",
        category: "10",
      })
    })
  })

  test("翌月を選択してもカテゴリなし条件を保持する", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5&category=none")

    await user.click(await screen.findByRole("button", { name: "Next month" }))

    await waitFor(() => {
      expectPaymentsSearch(router.state.location.search, {
        year: "2025",
        month: "6",
        category: "none",
      })
    })
  })
})

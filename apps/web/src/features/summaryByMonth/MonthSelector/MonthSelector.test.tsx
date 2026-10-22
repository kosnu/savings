import { createRoute } from "@tanstack/react-router"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { i18next } from "../../../i18n"
import { renderWithRouter as renderWithTestRouter } from "../../../test/helpers/renderWithRouter"
import { screen, waitFor, within } from "../../../test/test-utils"
import { paymentsSearchSchema } from "../../payments"
import { MonthSelector } from "./MonthSelector"

function renderMonthSelector(initialEntry: string) {
  window.history.replaceState({}, "", initialEntry)

  // URLごとのrouter state遷移を検証するため、固定argsのStoryではなくtest routerへ直接mountする。
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

afterEach(async () => {
  vi.useRealTimers()
  await i18next.changeLanguage("en")
})

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

    expect(await screen.findByRole("button", { name: "May 2025" })).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Year" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Month" })).not.toBeInTheDocument()
  })

  test("年月表示からポップオーバーを開き、閉じると年月表示へフォーカスを戻す", async () => {
    const { user } = renderMonthSelector("/payments?year=2025&month=5")
    const trigger = await screen.findByRole("button", { name: "May 2025" })

    await user.click(trigger)

    const popover = await screen.findByRole("dialog", { name: "Select year and month" })
    expect(within(popover).getByRole("combobox", { name: "Year" })).toBeInTheDocument()
    expect(within(popover).getByRole("combobox", { name: "Month" })).toBeInTheDocument()

    await user.click(within(popover).getByRole("button", { name: "Close Select year and month" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Select year and month" }),
      ).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })
  })

  test("日本語では現在年月とポップオーバー名を日本語で表示する", async () => {
    await i18next.changeLanguage("ja")
    const { user } = renderMonthSelector("/payments?year=2025&month=5")

    await user.click(await screen.findByRole("button", { name: "2025年5月" }))

    expect(await screen.findByRole("dialog", { name: "年月を選択" })).toBeInTheDocument()
  })

  test("年月を選択すると、クエリパラメータが更新される", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5")
    const trigger = await screen.findByRole("button", { name: "May 2025" })

    await user.click(trigger)

    await user.click(screen.getByRole("combobox", { name: "Month" }))
    expect(
      screen.getByRole("dialog", { name: "Select year and month", hidden: true }),
    ).toHaveAttribute("data-state", "open")

    const juneOption = await screen.findByRole("option", { name: "June" })
    await user.click(juneOption)

    await waitFor(() => {
      const { year, month } = router.state.location.search as {
        year?: string
        month?: string
      }
      expect(year).toBe("2025")
      expect(month).toBe("6")
      expect(screen.queryByRole("dialog", { name: "Select year and month" })).toBeNull()
      expect(trigger).toHaveTextContent("June 2025")
      expect(trigger).toHaveFocus()
    })
  })

  test.each([
    ["/payments?year=abc&month=5", "October 2026"],
    ["/payments?year=2025&month=abc", "October 2026"],
    ["/payments?year=2025&month=0", "October 2026"],
    ["/payments?year=2025&month=13", "October 2026"],
    ["/payments?year=2021&month=12", "October 2026"],
    ["/payments?year=2033&month=1", "October 2026"],
    ["/payments?year=2025", "October 2025"],
    ["/payments?month=5", "May 2026"],
  ])("不正または未指定の年月クエリ %s を共通ルールで補完する", async (initialEntry, label) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 15))
    renderMonthSelector(initialEntry)

    expect(await screen.findByRole("button", { name: label })).toBeInTheDocument()
  })

  test.each([
    [new Date(2021, 11, 31), "January 2022", "Previous month", "2022", "1"],
    [new Date(2033, 0, 1), "December 2032", "Next month", "2032", "12"],
  ])(
    "現在時刻 %s が範囲外でも境界から外へ移動しない",
    async (now, label, direction, year, month) => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(now)
      const { router, user } = renderMonthSelector("/payments")

      expect(await screen.findByRole("button", { name: label })).toBeInTheDocument()
      const button = screen.getByRole("button", { name: direction })
      expect(button).toBeDisabled()
      await user.click(button)
      expect(router.state.location.search).toEqual({})

      const allowedDirection = direction === "Previous month" ? "Next month" : "Previous month"
      await user.click(screen.getByRole("button", { name: allowedDirection }))
      await waitFor(() => {
        expectPaymentsSearch(router.state.location.search, {
          year,
          month: month === "1" ? "2" : "11",
        })
      })
    },
  )

  test("年月を選択してもカテゴリ条件を保持する", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5&category=10")

    await user.click(await screen.findByRole("button", { name: "May 2025" }))

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

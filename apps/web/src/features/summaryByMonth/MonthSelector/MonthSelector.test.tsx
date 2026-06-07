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

describe("MonthSelector", () => {
  test("クエリパラメータがある場合、その年月が表示される", async () => {
    renderMonthSelector("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument()
      expect(screen.getByText("2025")).toBeInTheDocument()
    })
  })

  test("年月を選択すると、クエリパラメータが更新される", async () => {
    const { router, user } = renderMonthSelector("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("combobox", { name: "Month" }))

    const juneOption = await screen.findByRole("option", { name: "6" })
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
      expect(screen.getByText("5")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("combobox", { name: "Month" }))

    const juneOption = await screen.findByRole("option", { name: "6" })
    await user.click(juneOption)

    await waitFor(() => {
      const { year, month, category } = router.state.location.search as {
        year?: string
        month?: string
        category?: string
      }
      expect(year).toBe("2025")
      expect(month).toBe("6")
      expect(category).toBe("10")
    })
  })
})

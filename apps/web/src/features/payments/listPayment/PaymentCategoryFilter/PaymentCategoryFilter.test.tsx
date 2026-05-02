import { createRoute } from "@tanstack/react-router"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import { renderWithRouter } from "../../../../test/helpers/renderWithRouter"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { server } from "../../../../test/msw/server"
import { screen, type TestUser, waitFor, within } from "../../../../test/test-utils"
import { paymentsSearchSchema } from "../paymentsSearchSchema"
import { PaymentCategoryFilter } from "./PaymentCategoryFilter"

function renderPaymentCategoryFilter(initialEntry: string) {
  return renderWithRouter(initialEntry, (root) => {
    const authenticatedRoute = createRoute({
      getParentRoute: () => root,
      id: "authenticated",
    })

    const paymentsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/payments",
      component: PaymentCategoryFilter,
      validateSearch: paymentsSearchSchema,
    })

    return [authenticatedRoute.addChildren([paymentsRoute])]
  })
}

async function selectCategoryFilterOption(user: TestUser, optionName: string) {
  await user.click(await screen.findByRole("combobox", { name: /category filter/i }))

  const listbox = await screen.findByRole("listbox")
  await waitFor(() => {
    expect(within(listbox).queryByRole("option", { name: /loading/i })).not.toBeInTheDocument()
  })

  await user.click(await within(listbox).findByRole("option", { name: optionName }))
}

describe("PaymentCategoryFilter", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategoryHandlers())
  })

  test("URL search にカテゴリ条件がない場合は All categories を表示する", async () => {
    renderPaymentCategoryFilter("/payments?year=2025&month=6")

    expect(await screen.findByRole("combobox", { name: /category filter/i })).toHaveTextContent(
      "All categories",
    )
  })

  test("登録済みカテゴリを選ぶと年月条件を保ったまま category を更新する", async () => {
    const { router, user } = renderPaymentCategoryFilter("/payments?year=2025&month=6")

    await selectCategoryFilterOption(user, "Food")

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
        category: "10",
      })
    })
  })

  test("カテゴリ未設定を選ぶと年月条件を保ったまま category=none にする", async () => {
    const { router, user } = renderPaymentCategoryFilter("/payments?year=2025&month=6")

    await selectCategoryFilterOption(user, "Uncategorized")

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
        category: "none",
      })
    })
  })

  test("All categories を選ぶと年月条件を保ったまま category を外す", async () => {
    const { router, user } = renderPaymentCategoryFilter(
      "/payments?year=2025&month=6&category=none",
    )

    await selectCategoryFilterOption(user, "All categories")

    await waitFor(() => {
      expect(router.state.location.search.year).toBe("2025")
      expect(router.state.location.search.month).toBe("6")
      expect(router.state.location.search.category).toBeUndefined()
      expect(router.state.location.href).not.toContain("category")
    })
  })
})

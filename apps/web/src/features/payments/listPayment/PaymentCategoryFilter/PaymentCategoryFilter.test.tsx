import { createRoute } from "@tanstack/react-router"
import { http } from "msw"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import { categories } from "../../../../test/data/categories"
import { renderWithRouter } from "../../../../test/helpers/renderWithRouter"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { server } from "../../../../test/msw/server"
import {
  createTestQueryClient,
  screen,
  type TestUser,
  waitFor,
  within,
} from "../../../../test/test-utils"
import type { Category } from "../../../../types/category"
import { categoryQueryKeys } from "../../../categories"
import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE, paymentsSearchSchema } from "../paymentsSearchSchema"
import { PaymentCategoryFilter } from "./PaymentCategoryFilter"

import styles from "./PaymentCategoryFilter.module.css"

function renderPaymentCategoryFilter(
  initialEntry: string,
  {
    cacheCategories = true,
    cachedCategories = categories,
  }: { cacheCategories?: boolean; cachedCategories?: Category[] } = {},
) {
  const queryClient = createTestQueryClient()
  if (cacheCategories) {
    queryClient.setQueryData(categoryQueryKeys.list, cachedCategories)
  }

  return renderWithRouter(
    initialEntry,
    (root) => {
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
    },
    { queryClient },
  )
}

async function selectCategoryFilterOption(user: TestUser, optionName: string | RegExp) {
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

  test("URL search のカテゴリ未設定を表示する", async () => {
    renderPaymentCategoryFilter(
      `/payments?year=2025&month=6&category=${PAYMENT_SEARCH_CATEGORY_NONE_VALUE}`,
    )

    expect(await screen.findByRole("combobox", { name: /category filter/i })).toHaveTextContent(
      "Uncategorized",
    )
    expect(await screen.findByRole("combobox", { name: /category filter/i })).toHaveClass(
      styles.systemLabel,
    )
    expect(screen.queryByText("No category")).not.toBeInTheDocument()
  })

  test("実在カテゴリ名 Uncategorized とカテゴリ未設定条件を区別できる", async () => {
    const { user } = renderPaymentCategoryFilter("/payments?year=2025&month=6", {
      cachedCategories: [
        ...categories,
        {
          id: 999,
          bookId: 1,
          name: "Uncategorized",
          createdDate: new Date(),
          updatedDate: new Date(),
        },
      ],
    })

    await user.click(await screen.findByRole("combobox", { name: /category filter/i }))

    const listbox = await screen.findByRole("listbox")
    const uncategorizedOptions = within(listbox).getAllByRole("option", {
      name: /^uncategorized$/i,
    })
    expect(uncategorizedOptions).toHaveLength(2)
    expect(uncategorizedOptions[0]).toHaveClass(styles.systemLabel)
    expect(uncategorizedOptions[1]).not.toHaveClass(styles.systemLabel)
    expect(within(listbox).queryByText("No category")).not.toBeInTheDocument()
  })

  test("URL search の登録済みカテゴリを表示する", async () => {
    renderPaymentCategoryFilter("/payments?year=2025&month=6&category=10")

    expect(await screen.findByRole("combobox", { name: /category filter/i })).toHaveTextContent(
      "Food",
    )
  })

  test("カテゴリ取得中でもURL searchの登録済みカテゴリは読み込み中表示にする", async () => {
    server.use(
      http.get("*/rest/v1/categories*", async () => {
        await new Promise(() => undefined)
      }),
    )

    renderPaymentCategoryFilter("/payments?year=2025&month=6&category=10", {
      cacheCategories: false,
    })

    expect(await screen.findByRole("combobox", { name: /category filter/i })).toHaveTextContent(
      "Loading",
    )
  })

  test("URL search のカテゴリが存在しない登録済みIDの場合は Unknown category を表示する", async () => {
    renderPaymentCategoryFilter("/payments?year=2025&month=6&category=999")

    expect(await screen.findByRole("combobox", { name: /category filter/i })).toHaveTextContent(
      "Unknown category",
    )
  })

  test("URL search の不正カテゴリは All categories に正規化する", async () => {
    const { router } = renderPaymentCategoryFilter("/payments?year=2025&month=6&category=-1")

    expect(await screen.findByRole("combobox", { name: /category filter/i })).toHaveTextContent(
      "All categories",
    )
    expect(router.state.location.search.category).toBeUndefined()
  })

  test("登録済みカテゴリを選ぶとcategoryをRouter searchに反映する", async () => {
    const { router, user } = renderPaymentCategoryFilter("/payments?year=2025&month=6")

    await selectCategoryFilterOption(user, "Food")

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
        category: "10",
      })
      expect(router.state.location.href).toBe("/payments?year=2025&month=6&category=10")
    })
  })

  test("カテゴリ未設定を選ぶとcategory=noneをRouter searchに反映する", async () => {
    const { router, user } = renderPaymentCategoryFilter("/payments?year=2025&month=6")

    await selectCategoryFilterOption(user, /^uncategorized$/i)

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
        category: PAYMENT_SEARCH_CATEGORY_NONE_VALUE,
      })
    })
  })

  test("All categories を選ぶとRouter searchからcategoryを外す", async () => {
    const { router, user } = renderPaymentCategoryFilter(
      `/payments?year=2025&month=6&category=${PAYMENT_SEARCH_CATEGORY_NONE_VALUE}`,
    )

    await selectCategoryFilterOption(user, "All categories")

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        year: "2025",
        month: "6",
        category: undefined,
      })
      expect(router.state.location.href).toBe("/payments?year=2025&month=6")
    })
  })
})

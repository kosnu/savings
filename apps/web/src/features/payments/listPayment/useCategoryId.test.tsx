import { createRoute, RouterProvider } from "@tanstack/react-router"
import { renderHook } from "@testing-library/react"
import type { PropsWithChildren, ReactNode } from "react"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { createTestRouter } from "../../../test/helpers/createTestRouter"
import { waitFor } from "../../../test/test-utils"
import { toPaymentCategoryId } from "./paymentCategorySearch"
import { paymentsSearchSchema } from "./paymentsSearchSchema"
import { useCategoryId } from "./useCategoryId"

vi.mock("./paymentCategorySearch", () => ({
  toPaymentCategoryId: vi.fn(() => 10),
}))

function renderUseCategoryId(initialEntry: string) {
  let routeChildren: ReactNode = null
  const router = createTestRouter(initialEntry, (root) => {
    const authenticatedRoute = createRoute({
      getParentRoute: () => root,
      id: "authenticated",
    })

    const paymentsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/payments",
      component: () => <>{routeChildren}</>,
      validateSearch: paymentsSearchSchema,
    })

    return [authenticatedRoute.addChildren([paymentsRoute])]
  })

  return renderHook(() => useCategoryId(), {
    wrapper: ({ children }: PropsWithChildren) => {
      routeChildren = children

      return <RouterProvider router={router} />
    },
  })
}

describe("useCategoryId", () => {
  beforeEach(() => {
    vi.mocked(toPaymentCategoryId).mockClear()
  })

  test("URL searchのcategoryをカテゴリID変換に渡す", async () => {
    const { result } = renderUseCategoryId("/payments?year=2025&month=6&category=10")

    await waitFor(() => {
      expect(toPaymentCategoryId).toHaveBeenCalledWith("10")
      expect(result.current).toBe(10)
    })
  })

  test("URL searchにcategoryがない場合はundefinedをカテゴリID変換に渡す", async () => {
    renderUseCategoryId("/payments?year=2025&month=6")

    await waitFor(() => {
      expect(toPaymentCategoryId).toHaveBeenCalledWith(undefined)
    })
  })
})

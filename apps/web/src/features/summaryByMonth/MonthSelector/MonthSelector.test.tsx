import { Theme } from "@radix-ui/themes"
import { createRoute, RouterProvider } from "@tanstack/react-router"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"

import {
  SupabaseSessionContext,
  type SupabaseSessionState,
} from "../../../providers/supabase/SupabaseSessionProvider"
import { mockSession } from "../../../test/data/supabaseSession"
import { createTestRouter } from "../../../test/helpers/createTestRouter"
import { paymentsSearchSchema } from "../../payments/listPayment/paymentsSearchSchema"
import { MonthSelector } from "./MonthSelector"

const mockSessionState: SupabaseSessionState = {
  session: mockSession(),
  loading: false,
}

function renderWithRouter(initialEntry: string) {
  const router = createTestRouter(initialEntry, (root) => {
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

  return {
    router,
    ...render(
      <SupabaseSessionContext value={mockSessionState}>
        <Theme>
          <RouterProvider router={router} />
        </Theme>
      </SupabaseSessionContext>,
    ),
  }
}

describe("MonthSelector", () => {
  afterEach(() => {
    cleanup()
  })

  test("クエリパラメータがない場合、今月の年月で初期化される", async () => {
    const { router } = renderWithRouter("/payments")

    await waitFor(() => {
      const { year, month } = router.state.location.search as {
        year?: string
        month?: string
      }
      expect(year).toMatch(/\d{4}/)
      expect(month).toMatch(/\d{1,2}/)
    })
  })

  test("クエリパラメータがある場合、その年月が表示される", async () => {
    renderWithRouter("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(screen.getByText("5月")).toBeInTheDocument()
      expect(screen.getByText("2025")).toBeInTheDocument()
    })
  })

  test("年月を選択すると、クエリパラメータが更新される", async () => {
    const user = userEvent.setup()

    const { router } = renderWithRouter("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(screen.getByText("5月")).toBeInTheDocument()
    })

    // 月のボタンをクリック
    await user.click(screen.getByRole("combobox", { name: "月" }))

    // 6月を選択
    const juneOption = await screen.findByRole("option", { name: "6月" })
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
})

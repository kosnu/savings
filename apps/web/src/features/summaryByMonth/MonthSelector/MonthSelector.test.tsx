import { createRoute } from "@tanstack/react-router"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { type SupabaseSessionState } from "../../../providers/supabase/SupabaseSessionProvider"
import { mockSession } from "../../../test/data/supabaseSession"
import { renderWithRouter as renderWithTestRouter } from "../../../test/helpers/renderWithRouter"
import { screen, waitFor } from "../../../test/test-utils"
import { paymentsSearchSchema } from "../../payments/listPayment/paymentsSearchSchema"
import { MonthSelector } from "./MonthSelector"

const mockSessionState: SupabaseSessionState = {
  status: "authenticated",
  session: mockSession(),
}

function renderMonthSelector(initialEntry: string) {
  return renderWithRouterHelper(initialEntry, mockSessionState)
}

function renderWithRouterHelper(initialEntry: string, sessionState: SupabaseSessionState) {
  return renderWithTestRouter(
    initialEntry,
    (root) => {
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
    },
    { sessionState },
  )
}

describe("MonthSelector", () => {
  test("クエリパラメータがない場合、今月の年月で初期化される", async () => {
    const { router } = renderMonthSelector("/payments")

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
    renderMonthSelector("/payments?year=2025&month=5")

    await waitFor(() => {
      expect(screen.getByText("5月")).toBeInTheDocument()
      expect(screen.getByText("2025")).toBeInTheDocument()
    })
  })

  test("年月を選択すると、クエリパラメータが更新される", async () => {
    const user = userEvent.setup()

    const { router } = renderMonthSelector("/payments?year=2025&month=5")

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

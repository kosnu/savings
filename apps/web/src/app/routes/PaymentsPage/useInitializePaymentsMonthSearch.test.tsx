import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { useInitializePaymentsMonthSearch } from "./useInitializePaymentsMonthSearch"

interface TestLocation {
  pathname: string
  search: {
    year?: string
    month?: string
    category?: string
  }
}

const { locationState, mockNavigate, mockUseSupabaseSession } = vi.hoisted(() => ({
  locationState: {
    pathname: "/payments",
    search: {},
  } as TestLocation,
  mockNavigate: vi.fn(),
  mockUseSupabaseSession: vi.fn(() => ({ session: { user: { id: "user-id" } } })),
}))

vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (location: TestLocation) => unknown }) =>
    select(locationState),
  useNavigate: () => mockNavigate,
}))

vi.mock("../../../providers/supabase/useSupabaseSession", () => ({
  useSupabaseSession: mockUseSupabaseSession,
}))

function renderUseInitializePaymentsMonthSearch(location: TestLocation) {
  locationState.pathname = location.pathname
  locationState.search = location.search

  renderHook(() => useInitializePaymentsMonthSearch())
}

describe("useInitializePaymentsMonthSearch", () => {
  beforeEach(() => {
    locationState.pathname = "/payments"
    locationState.search = {}
    mockNavigate.mockClear()
    mockUseSupabaseSession.mockReturnValue({ session: { user: { id: "user-id" } } })
  })

  test("年月 search がない場合は今月の年月で初期化する", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/payments",
      search: {},
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/payments",
        search: expect.any(Function) as unknown,
        replace: true,
      })
    })

    const searchUpdater = mockNavigate.mock.calls[0]?.[0].search as (
      prev: TestLocation["search"],
    ) => TestLocation["search"]
    expect(searchUpdater({})).toMatchObject({
      year: expect.stringMatching(/\d{4}/),
      month: expect.stringMatching(/\d{1,2}/),
    })
  })

  test("年月 search を初期化してもカテゴリ条件を保持する", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/payments",
      search: { category: "none" },
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })

    const searchUpdater = mockNavigate.mock.calls[0]?.[0].search as (
      prev: TestLocation["search"],
    ) => TestLocation["search"]
    expect(searchUpdater({ category: "none" })).toMatchObject({
      year: expect.stringMatching(/\d{4}/),
      month: expect.stringMatching(/\d{1,2}/),
      category: "none",
    })
  })

  test("年月 search がある場合は初期化しない", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/payments",
      search: { year: "2025", month: "6" },
    })

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  test("Payments 外の pathname では年月 search がなくても Payments に巻き戻さない", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/settings",
      search: {},
    })

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})

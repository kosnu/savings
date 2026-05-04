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

async function waitForEffectTick() {
  await new Promise((resolve) => setTimeout(resolve, 0))
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

  test("Payments 詳細 route では pathname を維持して年月 search を初期化する", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/payments/details/1",
      search: {},
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/payments/details/1",
        search: expect.any(Function) as unknown,
        replace: true,
      })
    })
  })

  test("year だけある場合は month だけ補完する", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/payments",
      search: { year: "2025" },
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })

    const searchUpdater = mockNavigate.mock.calls[0]?.[0].search as (
      prev: TestLocation["search"],
    ) => TestLocation["search"]
    expect(searchUpdater({ year: "2025" })).toMatchObject({
      year: "2025",
      month: expect.stringMatching(/\d{1,2}/),
    })
  })

  test("month だけある場合は year だけ補完する", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/payments",
      search: { month: "6" },
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })

    const searchUpdater = mockNavigate.mock.calls[0]?.[0].search as (
      prev: TestLocation["search"],
    ) => TestLocation["search"]
    expect(searchUpdater({ month: "6" })).toMatchObject({
      year: expect.stringMatching(/\d{4}/),
      month: "6",
    })
  })

  test("年月 search がある場合は初期化しない", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/payments",
      search: { year: "2025", month: "6" },
    })

    // useEffect が実行される前に no-op の検証が通ることを避けるため、effect の tick を待つ
    await waitForEffectTick()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test("Payments 外の pathname では年月 search がなくても Payments に巻き戻さない", async () => {
    renderUseInitializePaymentsMonthSearch({
      pathname: "/settings",
      search: {},
    })

    // useEffect が実行される前に no-op の検証が通ることを避けるため、effect の tick を待つ
    await waitForEffectTick()

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

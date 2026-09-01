import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { renderHook, waitFor } from "../../../test/test-utils"
import type { CategorySettingsItem } from "./types"
import { useCategorySettingsItems } from "./useCategorySettingsItems"

const { mockFetchCategorySettingsItems } = vi.hoisted(() => ({
  mockFetchCategorySettingsItems: vi.fn(),
}))

vi.mock("./fetchCategorySettingsItems", () => ({
  fetchCategorySettingsItems: mockFetchCategorySettingsItems,
}))

function buildCategorySettingsItem(id: number): CategorySettingsItem {
  return {
    category: {
      id,
      bookId: 1,
      name: `Category ${id}`,
    },
    pinned: false,
    budgetStatus: "unset",
    budgetAmount: null,
  }
}

describe("useCategorySettingsItems", () => {
  beforeEach(() => {
    mockFetchCategorySettingsItems.mockReset()
  })

  it("カテゴリ設定行を取得する", async () => {
    const items = [buildCategorySettingsItem(10), buildCategorySettingsItem(20)]
    mockFetchCategorySettingsItems.mockResolvedValue(items)

    const { result } = renderHook(() => useCategorySettingsItems())

    await waitFor(() => {
      expect(result.current.data).toEqual(items)
    })
    expect(mockFetchCategorySettingsItems).toHaveBeenCalledTimes(1)
  })
})

import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { renderHook } from "../../../test/test-utils"
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

    await expect(result.current.promise).resolves.toEqual(items)
    expect(mockFetchCategorySettingsItems).toHaveBeenCalledTimes(1)
  })

  it("取得に失敗した場合は promise を reject する", async () => {
    const error = new Error("failed")
    mockFetchCategorySettingsItems.mockRejectedValue(error)

    const { result } = renderHook(() => useCategorySettingsItems())

    await expect(result.current.promise).rejects.toBe(error)
  })
})

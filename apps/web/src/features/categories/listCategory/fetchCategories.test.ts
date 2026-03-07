import { describe, expect, it, vi } from "vitest"
import { fetchCategories } from "./fetchCategories"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "test-access-token",
          },
        },
        error: null,
      }),
    },
  }),
}))

describe("fetchCategories", () => {
  it("DTOをCategoryドメインオブジェクトに変換する", async () => {
    const categories = await fetchCategories()

    expect(categories).toHaveLength(3)
    expect(categories[0]).toEqual({
      id: 10,
      name: "Food",
      createdDate: new Date("2025-01-01T00:00:00.000Z"),
      updatedDate: new Date("2025-01-01T00:00:00.000Z"),
    })
    expect(categories[1]).toEqual({
      id: 20,
      name: "Daily Necessities",
      createdDate: new Date("2025-01-01T00:00:00.000Z"),
      updatedDate: new Date("2025-01-01T00:00:00.000Z"),
    })
    expect(categories[2]).toEqual({
      id: 30,
      name: "Entertainment",
      createdDate: new Date("2025-01-01T00:00:00.000Z"),
      updatedDate: new Date("2025-01-01T00:00:00.000Z"),
    })
  })

  it("createdAt/updatedAtをDateオブジェクトに変換する", async () => {
    const categories = await fetchCategories()

    for (const category of categories) {
      expect(category.createdDate).toBeInstanceOf(Date)
      expect(category.updatedDate).toBeInstanceOf(Date)
    }
  })
})

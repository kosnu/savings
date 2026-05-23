import type { QueryClient } from "@tanstack/react-query"

export const categoryQueryKeys = {
  all: ["categories"],
  list: ["categories", "list"],
  settingsItems: ["categories", "settingsItems"],
} as const

export async function invalidateCategoryQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all })
}

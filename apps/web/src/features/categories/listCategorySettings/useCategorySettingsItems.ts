import { useSuspenseQuery } from "@tanstack/react-query"

import { categoryQueryKeys } from "../queryKeys"
import { fetchCategorySettingsItems } from "./fetchCategorySettingsItems"
import type { CategorySettingsItem } from "./types"

interface UseCategorySettingsItemsReturn {
  data: CategorySettingsItem[]
}

export function useCategorySettingsItems(): UseCategorySettingsItemsReturn {
  const query = useSuspenseQuery({
    queryKey: categoryQueryKeys.settingsItems,
    queryFn: async () => fetchCategorySettingsItems(),
    staleTime: 3000,
  })

  return { data: query.data }
}

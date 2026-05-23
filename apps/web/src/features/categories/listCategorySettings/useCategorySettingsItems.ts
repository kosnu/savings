import { useQuery } from "@tanstack/react-query"

import { categoryQueryKeys } from "../queryKeys"
import { fetchCategorySettingsItems } from "./fetchCategorySettingsItems"
import type { CategorySettingsItem } from "./types"

interface UseCategorySettingsItemsReturn {
  promise: Promise<CategorySettingsItem[]>
}

export function useCategorySettingsItems(): UseCategorySettingsItemsReturn {
  const query = useQuery({
    queryKey: categoryQueryKeys.settingsItems,
    queryFn: async () => fetchCategorySettingsItems(),
    staleTime: 3000,
  })

  return { promise: query.promise }
}

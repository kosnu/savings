import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { profileQueryKeys } from "./profileQueryKeys"
import { updateDisplayName as updateDisplayNameRecord } from "./updateDisplayName"

interface UseUpdateDisplayNameReturn {
  updateDisplayName: (name: string) => Promise<void>
  isPending: boolean
}

export function useUpdateDisplayName(authUserId: string): UseUpdateDisplayNameReturn {
  const queryClient = useQueryClient()
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (name: string) => updateDisplayNameRecord({ authUserId, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current(authUserId) })
    },
  })

  const updateDisplayName = useCallback(
    async (name: string) => {
      await mutateAsync(name)
    },
    [mutateAsync],
  )

  return { updateDisplayName, isPending }
}

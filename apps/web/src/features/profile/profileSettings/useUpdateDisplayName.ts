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
    mutationFn: async (name: string) => {
      await updateDisplayNameRecord({ authUserId, name })
      await queryClient.refetchQueries(
        {
          queryKey: profileQueryKeys.current(authUserId),
          type: "all",
        },
        { throwOnError: true },
      )
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

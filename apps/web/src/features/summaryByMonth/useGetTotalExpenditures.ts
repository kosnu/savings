import { useCallback } from "react"
import { useFirestore } from "../../providers/firebase/useFirestore"
import { useAuthCurrentUser } from "../../utils/auth/useAuthCurrentUser"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"

interface UseGetTotalExpendituresReturn {
  getTotalExpenditures: (
    dateRange: [Date | null, Date | null],
  ) => Promise<number | null>
}

export function useGetTotalExpenditures(): UseGetTotalExpendituresReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const getTotalExpenditures = useCallback(
    async (dateRange: [Date | null, Date | null]) => {
      return await fetchTotalExpenditures(db, currentUser, dateRange)
    },
    [db, currentUser],
  )

  return {
    getTotalExpenditures: getTotalExpenditures,
  }
}

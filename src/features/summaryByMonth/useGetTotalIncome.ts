import { useCallback } from "react"
import { useAuthCurrentUser } from "../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../utils/firebase/useFirestore"
import { fetchTotalIncome } from "./fetchTotalIncome"

interface UseGetTotalIncomeReturn {
  getTotalIncome: (
    dateRange: [Date | null, Date | null],
  ) => Promise<number | null>
}

export function useGetTotalIncome(): UseGetTotalIncomeReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const getTotalIncome = useCallback(
    async (dateRange: [Date | null, Date | null]) => {
      return await fetchTotalIncome(db, currentUser, dateRange)
    },
    [db, currentUser],
  )

  return {
    getTotalIncome: getTotalIncome,
  }
}

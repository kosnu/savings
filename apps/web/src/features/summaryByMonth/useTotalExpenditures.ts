import { useQuery } from "@tanstack/react-query"
import { useFirestore } from "../../providers/firebase/useFirestore"
import { useAuthCurrentUser } from "../../utils/auth/useAuthCurrentUser"
import { useDateRange } from "../../utils/useDateRange"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"

interface UseTotalExpendituresReturn {
  data: number | null
  loading: boolean
  error: Error | null
  promise: Promise<number | null>
}

export function useTotalExpenditures(): UseTotalExpendituresReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()
  const { date, dateRange } = useDateRange()

  const query = useQuery({
    queryKey: [
      "totalExpenditures",
      currentUser?.uid,
      date?.toISOString() ?? "all",
    ],
    queryFn: () => fetchTotalExpenditures(db, currentUser, dateRange),
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    promise: query.promise,
  }
}

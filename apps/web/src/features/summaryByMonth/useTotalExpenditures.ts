import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { useDateRange } from "../../utils/useDateRange"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"

interface UseTotalExpendituresReturn {
  data: number | null
  loading: boolean
  error: Error | null
  promise: Promise<number | null>
}

export function useTotalExpenditures(): UseTotalExpendituresReturn {
  const { date } = useDateRange()
  const month = date ? format(date, "yyyy-MM") : ""

  const query = useQuery({
    queryKey: ["totalExpenditures", month],
    queryFn: () => fetchTotalExpenditures(month),
    enabled: !!month,
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    promise: query.promise,
  }
}

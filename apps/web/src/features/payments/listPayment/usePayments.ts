import { useQuery } from "@tanstack/react-query"

import type { Payment } from "../../../types/payment"
import { useDateRange } from "../../../utils/useDateRange"
import { fetchPayments } from "./fetchPayments"

interface UseGetPaymentsReturn {
  data: Payment[]
  loading: boolean
  promise: Promise<Payment[]>
  error: Error | null
}

interface UsePaymentsOptions {
  categoryId?: number | null
}

export function usePayments({ categoryId }: UsePaymentsOptions = {}): UseGetPaymentsReturn {
  const { date, dateRange } = useDateRange()
  const query = useQuery({
    queryKey: ["payments", date?.toISOString() ?? "all", getCategoryQueryKey(categoryId)],
    queryFn: async () => fetchPayments(dateRange, { categoryId }),
    enabled: date !== null,
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    promise: query.promise,
    error: query.error,
  }
}

function getCategoryQueryKey(categoryId: number | null | undefined): string {
  if (categoryId === undefined) return "all-categories"
  if (categoryId === null) return "uncategorized"
  return `category-${categoryId}`
}

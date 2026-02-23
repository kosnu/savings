import { apiClient, buildFunctionUrl } from "../../lib/apiClient"

interface TotalResponse {
  totalAmount: number
  month: string
}

export async function fetchTotalExpenditures(
  month: string,
): Promise<number | null> {
  if (!month) {
    return null
  }

  const url = buildFunctionUrl("payments", "/total")
  const response = await apiClient.get<TotalResponse>(url, {
    params: { month },
  })

  return response.totalAmount
}

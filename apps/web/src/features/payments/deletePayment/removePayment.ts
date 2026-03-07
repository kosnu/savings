import { apiClient, buildFunctionUrl } from "../../../lib/apiClient"

export async function removePayment(paymentId: number): Promise<void> {
  const url = buildFunctionUrl("payments", `/${paymentId}`)
  await apiClient.delete(url)
}

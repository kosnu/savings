import { format } from "date-fns"
import { apiClient, buildFunctionUrl } from "../../../lib/apiClient"
import type { Payment } from "../../../types/payment"

interface PaymentDto {
  id: string
  note: string | null
  amount: number
  date: string
  createdAt: string | null
  updatedAt: string | null
  categoryId: string | null
  userId: string
}

interface PaymentsResponse {
  payments: PaymentDto[]
}

export async function fetchPayments([startDate, endDate]: [
  Date | null,
  Date | null,
]): Promise<Payment[]> {
  const url = buildFunctionUrl("payments")
  const params: Record<string, string | undefined> = {
    dateFrom: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
    dateTo: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
  }
  const response = await apiClient.get<PaymentsResponse>(url, { params })
  return response.payments.map((dto) => ({
    id: dto.id,
    categoryId: dto.categoryId ?? "",
    note: dto.note ?? "",
    amount: dto.amount,
    date: new Date(dto.date),
    userId: dto.userId,
    createdDate: dto.createdAt ? new Date(dto.createdAt) : new Date(),
    updatedDate: dto.updatedAt ? new Date(dto.updatedAt) : new Date(),
  }))
}

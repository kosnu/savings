import { type DelayMode, HttpResponse, delay, http } from "msw"

import type { ExportPayment } from "../../../features/payments/exportPayments/fetchExportPayments"

export const exportPayment: ExportPayment = {
  id: 1,
  book_id: 1,
  date: "2026-10-01",
  amount: 1234,
  note: "メモ",
  category_id: null,
  category: null,
}

interface PaymentExportOptions {
  response?: ExportPayment[]
  count?: number
  error?: boolean
  durationOrMode?: number | DelayMode
}

export function createPaymentExportHandlers({
  response = [exportPayment],
  count = response.length,
  error = false,
  durationOrMode = 0,
}: PaymentExportOptions = {}) {
  return [
    http.post("*/rest/v1/rpc/export_payments", async () => {
      await delay(durationOrMode)
      if (error) return HttpResponse.json({ message: "Export failed" }, { status: 500 })
      return HttpResponse.json({ count, payments: count > 10_000 ? [] : response })
    }),
  ]
}

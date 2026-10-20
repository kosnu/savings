import * as z from "zod"

export const PAYMENT_EXPORT_LIMIT = 10_000

export const exportPaymentsSchema = z
  .object({
    startDate: z.iso.date({ error: "exportPayments.invalidDate" }),
    endDate: z.iso.date({ error: "exportPayments.invalidDate" }),
  })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    path: ["endDate"],
    message: "exportPayments.invalidRange",
  })

export type ExportPaymentsPeriod = z.infer<typeof exportPaymentsSchema>

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
  .refine(
    ({ startDate, endDate }) => {
      if (!z.iso.date().safeParse(startDate).success || !z.iso.date().safeParse(endDate).success) {
        return true
      }
      const [year, month, day] = startDate.split("-").map(Number)
      const boundary = new Date(0)
      boundary.setUTCFullYear(year + 1, month - 1, day)
      return new Date(`${endDate}T00:00:00Z`).getTime() < boundary.getTime()
    },
    {
      path: ["endDate"],
      message: "exportPayments.periodLimit",
    },
  )

export type ExportPaymentsPeriod = z.infer<typeof exportPaymentsSchema>

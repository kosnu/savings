import * as z from "zod"

import { MAX_DATE_ONLY, MIN_DATE_ONLY } from "../../../domain/date"

export const PAYMENT_EXPORT_LIMIT = 10_000

const exportDateSchema = z.iso.date({ error: "exportPayments.invalidDate" }).pipe(
  z.string().refine((value) => MIN_DATE_ONLY <= value && value <= MAX_DATE_ONLY, {
    error: "exportPayments.invalidDate",
  }),
)

export const exportPaymentsSchema = z
  .object({
    startDate: exportDateSchema,
    endDate: exportDateSchema,
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

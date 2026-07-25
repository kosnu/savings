import { subMonths } from "date-fns"

import { toDateOnlyString } from "../../../domain/date"

const FREQUENT_PAYMENT_MINIMUM_COUNT = 3
const FREQUENT_PAYMENT_LIMIT = 5

export interface FrequentPaymentDateRange {
  startDate: string
  endDate: string
}

export interface FrequentPaymentSource {
  note: string | null
  amount: number
  categoryId: number | null
  categoryName?: string | null
}

export interface FrequentPayment {
  note: string
  amount: number
  categoryId: number | null
  categoryName: string | null
  count: number
}

export function getFrequentPaymentDateRange(referenceDate: Date): FrequentPaymentDateRange {
  return {
    startDate: toDateOnlyString(subMonths(referenceDate, 1)),
    endDate: toDateOnlyString(referenceDate),
  }
}

export function findFrequentPayments(sources: FrequentPaymentSource[]): FrequentPayment[] {
  const candidates = new Map<string, FrequentPayment>()

  for (const source of sources) {
    if (source.note === null || source.note.trim() === "") {
      continue
    }

    const key = JSON.stringify([source.note, source.amount, source.categoryId])
    const candidate = candidates.get(key)

    if (candidate) {
      candidate.count += 1
      continue
    }

    candidates.set(key, {
      note: source.note,
      amount: source.amount,
      categoryId: source.categoryId,
      categoryName: source.categoryName ?? null,
      count: 1,
    })
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.count >= FREQUENT_PAYMENT_MINIMUM_COUNT)
    .sort(compareFrequentPayments)
    .slice(0, FREQUENT_PAYMENT_LIMIT)
}

function compareFrequentPayments(a: FrequentPayment, b: FrequentPayment): number {
  if (a.count !== b.count) {
    return b.count - a.count
  }

  if (a.note !== b.note) {
    return a.note < b.note ? -1 : 1
  }

  if (a.amount !== b.amount) {
    return a.amount - b.amount
  }

  if (a.categoryId === b.categoryId) {
    return 0
  }
  if (a.categoryId === null) {
    return -1
  }
  if (b.categoryId === null) {
    return 1
  }

  return a.categoryId - b.categoryId
}

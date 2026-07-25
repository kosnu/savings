import { describe, expect, test } from "vite-plus/test"

import {
  findFrequentPayments,
  getFrequentPaymentDateRange,
  type FrequentPaymentSource,
} from "./frequentPayment"

function repeatedSource(count: number, source: FrequentPaymentSource): FrequentPaymentSource[] {
  return Array.from({ length: count }, () => ({ ...source }))
}

describe("getFrequentPaymentDateRange", () => {
  test("基準日の1か月前から当日までのdate-only範囲を返す", () => {
    expect(getFrequentPaymentDateRange(new Date(2026, 6, 25))).toEqual({
      startDate: "2026-06-25",
      endDate: "2026-07-25",
    })
  })

  test("前月に同じ日がない場合は前月末日を開始日にする", () => {
    expect(getFrequentPaymentDateRange(new Date(2026, 2, 31))).toEqual({
      startDate: "2026-02-28",
      endDate: "2026-03-31",
    })
  })
})

describe("findFrequentPayments", () => {
  test("同じメモ・金額・カテゴリが3件以上ある支払いを候補にする", () => {
    const sources = repeatedSource(3, {
      note: "Lunch",
      amount: 1200,
      categoryId: 10,
    })

    expect(findFrequentPayments(sources)).toEqual([
      {
        note: "Lunch",
        amount: 1200,
        categoryId: 10,
        categoryName: null,
        count: 3,
      },
    ])
  })

  test("2件以下の組み合わせは候補にしない", () => {
    expect(
      findFrequentPayments(
        repeatedSource(2, {
          note: "Lunch",
          amount: 1200,
          categoryId: 10,
        }),
      ),
    ).toEqual([])
  })

  test("メモ・金額・カテゴリのいずれかが異なる支払いを別候補として数える", () => {
    const sources = [
      ...repeatedSource(3, { note: "Lunch", amount: 1200, categoryId: 10 }),
      ...repeatedSource(3, { note: "Lunch", amount: 1300, categoryId: 10 }),
      ...repeatedSource(3, { note: "Lunch", amount: 1200, categoryId: 20 }),
      ...repeatedSource(3, { note: "Dinner", amount: 1200, categoryId: 10 }),
    ]

    expect(findFrequentPayments(sources)).toHaveLength(4)
  })

  test("カテゴリなし同士と0円を有効な同一候補として数える", () => {
    const sources = repeatedSource(3, {
      note: "Free entry",
      amount: 0,
      categoryId: null,
    })

    expect(findFrequentPayments(sources)).toEqual([
      {
        note: "Free entry",
        amount: 0,
        categoryId: null,
        categoryName: null,
        count: 3,
      },
    ])
  })

  test("null・空文字・空白のみのメモは候補にしない", () => {
    const sources = [
      ...repeatedSource(3, { note: null, amount: 100, categoryId: null }),
      ...repeatedSource(3, { note: "", amount: 100, categoryId: null }),
      ...repeatedSource(3, { note: "   ", amount: 100, categoryId: null }),
    ]

    expect(findFrequentPayments(sources)).toEqual([])
  })

  test("件数降順で並べ、同件数はメモ・金額・カテゴリの順で決定する", () => {
    const sources = [
      ...repeatedSource(3, { note: "B", amount: 100, categoryId: 20 }),
      ...repeatedSource(4, { note: "C", amount: 100, categoryId: 10 }),
      ...repeatedSource(3, { note: "A", amount: 200, categoryId: 10 }),
      ...repeatedSource(3, { note: "A", amount: 100, categoryId: 10 }),
      ...repeatedSource(3, { note: "A", amount: 100, categoryId: null }),
    ]

    expect(
      findFrequentPayments(sources).map(({ note, amount, categoryId, count }) => ({
        note,
        amount,
        categoryId,
        count,
      })),
    ).toEqual([
      { note: "C", amount: 100, categoryId: 10, count: 4 },
      { note: "A", amount: 100, categoryId: null, count: 3 },
      { note: "A", amount: 100, categoryId: 10, count: 3 },
      { note: "A", amount: 200, categoryId: 10, count: 3 },
      { note: "B", amount: 100, categoryId: 20, count: 3 },
    ])
  })

  test("候補は最大5件に制限する", () => {
    const sources = Array.from({ length: 6 }, (_, index) =>
      repeatedSource(3, {
        note: `Candidate ${index + 1}`,
        amount: index,
        categoryId: null,
      }),
    ).flat()

    expect(findFrequentPayments(sources)).toHaveLength(5)
  })
})

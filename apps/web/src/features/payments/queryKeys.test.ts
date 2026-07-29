import { describe, expect, it } from "vite-plus/test"

import { paymentQueryKeys } from "./queryKeys"

describe("paymentQueryKeys", () => {
  it("同じ一覧条件でもBookごとにquery keyを分離する", () => {
    expect(paymentQueryKeys.list(42, "page", "2026-07", null)).not.toEqual(
      paymentQueryKeys.list(43, "page", "2026-07", null),
    )
  })

  it("同じPayment IDでもBookごとに詳細query keyを分離する", () => {
    expect(paymentQueryKeys.details(42, 10)).not.toEqual(paymentQueryKeys.details(43, 10))
  })

  it("同じ期間でもBookごとに候補query keyを分離する", () => {
    expect(paymentQueryKeys.frequent(42, "2026-06-28", "2026-07-28")).not.toEqual(
      paymentQueryKeys.frequent(43, "2026-06-28", "2026-07-28"),
    )
  })
})

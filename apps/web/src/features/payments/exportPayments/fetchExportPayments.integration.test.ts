import { HttpResponse, http } from "msw"
import { describe, expect, it, vi } from "vite-plus/test"

import {
  createPaymentExportHandlers,
  exportPayment,
} from "../../../test/msw/handlers/paymentExports"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchExportPayments, PaymentExportLimitError } from "./fetchExportPayments"

vi.mock("../../../lib/supabase", () => ({ getSupabaseClient: () => supabaseTestClient }))
const period = { startDate: "2026-10-01", endDate: "2026-10-31" }
const fetchRows = async () => fetchExportPayments(1, period, new AbortController().signal)

describe("CSV用支払い取得", () => {
  it("明示Book・期間だけを単一RPCへ送り、同件数の入替えでも分割取得しない", async () => {
    const rows = [1, 2, 3, 4].map((id) => ({ ...exportPayment, id }))
    const requests: unknown[] = []
    server.use(
      http.post("*/rest/v1/rpc/export_payments", async ({ request }) => {
        requests.push(await request.json())
        // 後続要求があれば別時点のデータになる反例。呼出しは1回で完了する。
        return HttpResponse.json({
          count: 4,
          payments:
            requests.length === 1 ? rows : rows.slice(1).concat({ ...exportPayment, id: 5 }),
        })
      }),
    )
    expect(await fetchRows()).toEqual(rows)
    expect(requests).toEqual([
      { p_book_id: 1, p_start_date: period.startDate, p_end_date: period.endDate },
    ])
  })

  it.each([1, 1000, 1001, 10_000])("%i件を単一JSONのまま全件取得する", async (count) => {
    const rows = Array.from({ length: count }, (_, index) => ({ ...exportPayment, id: index + 1 }))
    server.use(...createPaymentExportHandlers({ response: rows }))
    expect(await fetchRows()).toEqual(rows)
  })

  it("最大1年を超える期間はRPCを呼び出す前に拒否する", async () => {
    let calls = 0
    server.use(
      http.post("*/rest/v1/rpc/export_payments", () => {
        calls++
        return HttpResponse.json({ count: 0, payments: [] })
      }),
    )
    await expect(
      fetchExportPayments(
        1,
        { startDate: "2024-02-29", endDate: "2025-03-01" },
        new AbortController().signal,
      ),
    ).rejects.toThrow()
    expect(calls).toBe(0)
  })

  it("10,001件以上なら最初の応答で拒否する", async () => {
    server.use(...createPaymentExportHandlers({ count: 10_001 }))
    await expect(fetchRows()).rejects.toBeInstanceOf(PaymentExportLimitError)
  })

  it("0件は正常な空結果として返す", async () => {
    server.use(...createPaymentExportHandlers({ response: [] }))
    expect(await fetchRows()).toEqual([])
  })

  it.each([
    { ...exportPayment, book_id: 2 },
    { ...exportPayment, date: "2026-09-30" },
    { ...exportPayment, date: "2026-11-01" },
    { ...exportPayment, date: "2026-02-30" },
    { ...exportPayment, amount: 1.5 },
    { ...exportPayment, category_id: 2, category: null },
    { ...exportPayment, category_id: 2, category: { id: 2, book_id: 2, name: "別Book" } },
    { ...exportPayment, category_id: null, category: undefined },
  ])("不正な行や参照をカテゴリ未設定と混同せず拒否する", async (row) => {
    server.use(
      http.post("*/rest/v1/rpc/export_payments", () =>
        HttpResponse.json({ count: 1, payments: [row] }),
      ),
    )
    await expect(fetchRows()).rejects.toThrow()
  })

  it.each([
    { payments: [exportPayment] },
    { count: 2, payments: [exportPayment] },
    { count: 2, payments: [exportPayment, exportPayment] },
    { count: -1, payments: [] },
    { count: 0, payments: null },
    null,
  ])("件数不明・欠落・重複・不正応答を成功にしない", async (response) => {
    server.use(http.post("*/rest/v1/rpc/export_payments", () => HttpResponse.json(response)))
    await expect(fetchRows()).rejects.toThrow()
  })

  it("RPCエラーを空結果や成功にしない", async () => {
    server.use(...createPaymentExportHandlers({ error: true }))
    await expect(fetchRows()).rejects.toThrow()
  })
})

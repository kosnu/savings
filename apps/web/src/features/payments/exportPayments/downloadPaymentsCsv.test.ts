import { describe, expect, it } from "vite-plus/test"

import { exportPayment } from "../../../test/msw/handlers/paymentExports"
import { createPaymentsCsv } from "./downloadPaymentsCsv"

describe("支払いCSV", () => {
  it("BOM、CRLF、指定の列順でdate-onlyと整数を保持し、未設定値を空欄にする", () => {
    expect(createPaymentsCsv([{ ...exportPayment, amount: 2147483647, note: null }])).toBe(
      '\uFEFF"支払日","金額","カテゴリ名","メモ"\r\n"2026-10-01","2147483647","",""\r\n',
    )
  })

  it("日本語、カンマ、引用符、改行をセル内に保持する", () => {
    expect(
      createPaymentsCsv([
        {
          ...exportPayment,
          category_id: 2,
          category: { id: 2, book_id: 1, name: '食費,"外食"' },
          note: 'メモ\r\n二行目,"引用"',
        },
      ]),
    ).toContain('"食費,""外食""","メモ\r\n二行目,""引用"""\r\n')
  })

  it.each(["=1+1", "+1+1", "-1+1", "@SUM(1)", "  =1+1", "\tメモ", "\r=1", "\n=1"])(
    "数式として評価され得る文字列 %j をカテゴリとメモでテキスト化する",
    (value) => {
      const csv = createPaymentsCsv([
        {
          ...exportPayment,
          note: value,
          category_id: 2,
          category: { id: 2, book_id: 1, name: value },
        },
      ])
      expect(csv).toContain(`"'${value}","'${value}"`)
    },
  )
})

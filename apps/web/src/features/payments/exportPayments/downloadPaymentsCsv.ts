import type { ExportPaymentsPeriod } from "./exportPaymentsSchema"
import type { ExportPayment } from "./fetchExportPayments"

function csvCell(value: string): string {
  // 引用符だけでは数式を防げないため、危険な先頭文字を持つ文字列をテキスト化する。
  const safeValue =
    /^[=+\-@]/u.test(value.trimStart()) ||
    value.trimStart().charCodeAt(0) < 32 ||
    /^[\t\r\n]/u.test(value)
      ? `'${value}`
      : value
  return `"${safeValue.replace(/"/gu, '""')}"`
}

export function createPaymentsCsv(payments: ExportPayment[]): string {
  const rows = [
    ["支払日", "金額", "カテゴリ名", "メモ"],
    ...payments.map((payment) => [
      payment.date,
      String(payment.amount),
      payment.category?.name ?? "",
      payment.note ?? "",
    ]),
  ]
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`
}

export function downloadPaymentsCsv(payments: ExportPayment[], period: ExportPaymentsPeriod): void {
  const blob = new Blob([createPaymentsCsv(payments)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  try {
    link.href = url
    link.download = `burneto-payments_${period.startDate}_${period.endDate}.csv`
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    // ダウンロード処理がURLを読み取るまで、破棄を次のタスクへ遅らせる。
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

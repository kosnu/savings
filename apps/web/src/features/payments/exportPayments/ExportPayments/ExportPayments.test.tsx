import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { selectDate } from "../../../../test/helpers/selectDate"
import { createBookHandlers } from "../../../../test/msw/handlers/books"
import {
  createPaymentExportHandlers,
  exportPayment,
} from "../../../../test/msw/handlers/paymentExports"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./ExportPayments.stories"

const { Default } = composeStories(stories)
const createObjectURL = vi.fn((_blob: Blob) => "blob:payments")
const revokeObjectURL = vi.fn()

async function fillPeriod(
  user: ReturnType<typeof render>["user"],
  startDate = "2026-10-01",
  endDate = "2026-10-31",
) {
  await selectDate(user, screen.getByLabelText(/Start date/), startDate)
  await selectDate(user, screen.getByLabelText(/End date/), endDate)
}

describe("設定からの支払いCSV出力", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 15))
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = createObjectURL
        static revokeObjectURL = revokeObjectURL
      },
    )
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    server.use(...createBookHandlers(), ...createPaymentExportHandlers())
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("設定見出し・上限注記を表示し、指定期間のCSVとファイル名でダウンロードする", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click")
    const { user } = render(<Default />)
    expect(screen.getByRole("heading", { name: "Payment data export" })).toBeInTheDocument()
    expect(screen.getByText(/Up to 10,000 payments/)).toBeInTheDocument()
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(click).toHaveBeenCalledOnce()
    const link = click.mock.instances[0]
    expect(link).toHaveAttribute("download", "burneto-payments_2026-10-01_2026-10-31.csv")
    expect(link).toHaveAttribute("href", "blob:payments")
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe("text/csv;charset=utf-8")
    const text = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsText(blob)
    })
    expect(text).toContain('"支払日","金額","カテゴリ名","メモ"\r\n"2026-10-01","1234","","メモ"')
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:payments"))
    expect(document.querySelector("a[download]")).toBeNull()
  })

  it("日付未入力と逆転した期間を送信せず、入力直下にエラーを示す", async () => {
    const { user } = render(<Default />)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findAllByText("Enter a valid date.")).toHaveLength(2)
    await fillPeriod(user, "2026-10-31", "2026-10-01")
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findByText("End date must be on or after start date.")).toBeInTheDocument()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/End date/)).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByLabelText(/End date/)).toHaveAccessibleDescription(
      "End date must be on or after start date.",
    )
  })

  it("取得中は期間と送信操作を無効化し、再操作できない", async () => {
    server.use(...createPaymentExportHandlers({ durationOrMode: "infinite" }))
    const { user, unmount } = render(<Default />)
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled())
    expect(screen.getByLabelText(/Start date/)).toBeDisabled()
    expect(screen.getByLabelText(/End date/)).toBeDisabled()
    expect(createObjectURL).not.toHaveBeenCalled()
    unmount()
  })

  it.each([
    [{ response: [] }, "No payments in this period.", "status"],
    [
      { count: 10_001 },
      "More than 10,000 payments match. Shorten the period and try again. No CSV was exported.",
      "alert",
    ],
    [{ error: true }, "Could not export payments. Try again.", "alert"],
  ] as const)("空・超過・失敗を区別してCSVを出力しない", async (options, message, role) => {
    server.use(
      ...createPaymentExportHandlers({
        ...options,
        response: "response" in options ? [] : undefined,
      }),
    )
    const { user } = render(<Default />)
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findByRole(role)).toHaveTextContent(message)
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Start date/)).toHaveValue("Oct 1, 2026")
  })

  it("Book取得失敗後も入力を保ち、同じ期間で再実行できる", async () => {
    server.use(...createBookHandlers({ error: true }))
    const { user } = render(<Default />)
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not export payments.")
    expect(createObjectURL).not.toHaveBeenCalled()
    server.use(...createBookHandlers())
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("上限超過後は期間を短くして再実行できる", async () => {
    server.use(...createPaymentExportHandlers({ count: 10_001 }))
    const { user } = render(<Default />)
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Shorten the period")
    server.use(...createPaymentExportHandlers())
    await fillPeriod(user, "2026-10-01", "2026-10-01")
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
  })

  it("件数と明細が一致しない応答では一部CSVを出力しない", async () => {
    server.use(
      http.post("*/rest/v1/rpc/export_payments", () =>
        HttpResponse.json({ count: 2, payments: [exportPayment] }),
      ),
    )
    const { user } = render(<Default />)
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not export payments.")
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("1年超過は期間短縮を案内し、Book・支払いの取得を開始しない", async () => {
    vi.setSystemTime(new Date(2024, 1, 15))
    let requests = 0
    server.use(
      http.get("*/rest/v1/book_members*", () => {
        requests++
        return HttpResponse.error()
      }),
      http.post("*/rest/v1/rpc/export_payments", () => {
        requests++
        return HttpResponse.error()
      }),
    )
    const { user } = render(<Default />)
    await fillPeriod(user, "2024-02-29", "2025-03-01")
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findByText("Shorten the period to at most one year.")).toBeInTheDocument()
    expect(requests).toBe(0)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("カレンダーで選んだうるう日から最大1年の両端をdate-onlyのまま送る", async () => {
    vi.setSystemTime(new Date(2024, 1, 15))
    const periods: unknown[] = []
    server.use(
      http.post("*/rest/v1/rpc/export_payments", async ({ request }) => {
        periods.push(await request.json())
        return HttpResponse.json({
          count: 1,
          payments: [{ ...exportPayment, date: "2024-02-29" }],
        })
      }),
    )
    const { user } = render(<Default />)
    await fillPeriod(user, "2024-02-29", "2025-02-28")
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(periods).toEqual([
      { p_book_id: 1, p_start_date: "2024-02-29", p_end_date: "2025-02-28" },
    ])
  })

  it("ファイル出力失敗を成功にしない", async () => {
    createObjectURL.mockImplementationOnce(() => {
      throw new Error("Blob unavailable")
    })
    const { user } = render(<Default />)
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not export payments.")
    expect(screen.queryByText("CSV download started.")).not.toBeInTheDocument()
  })

  it("画面を離れた後の応答でCSVを出力しない", async () => {
    server.use(...createPaymentExportHandlers({ durationOrMode: 50 }))
    const { user, unmount } = render(<Default />)
    await fillPeriod(user)
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})

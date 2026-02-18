import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, test, vi } from "vitest"
import { MonthSelector } from "./MonthSelector"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe("MonthSelector", () => {
  afterEach(() => {
    cleanup()
    mockNavigate.mockClear()
  })

  test("クエリパラメータがない場合、今月の年月で初期化される", async () => {
    render(
      <MemoryRouter initialEntries={["/payments"]}>
        <MonthSelector />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/payments?"),
        { replace: true },
      )
    })

    const call = mockNavigate.mock.calls[0][0]
    expect(call).toMatch(/year=\d{4}/)
    expect(call).toMatch(/month=\d{1,2}/)
  })

  test("クエリパラメータがある場合、その年月が表示される", () => {
    render(
      <MemoryRouter initialEntries={["/payments?year=2025&month=5"]}>
        <MonthSelector />
      </MemoryRouter>,
    )

    const textbox = screen.getByRole("textbox")
    expect(textbox).toHaveValue("2025年5月")
  })

  test("年月を選択すると、クエリパラメータが更新される", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/payments?year=2025&month=5"]}>
        <MonthSelector />
      </MemoryRouter>,
    )

    const textbox = screen.getByRole("textbox")
    await user.click(textbox)

    // カレンダーの日付をクリック
    const dayButton = screen.getByRole("button", { name: /2026年2月20日/ })
    await user.click(dayButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/payments?year=2026&month=2")
    })
  })

  test("「Month」ラベルが表示される", () => {
    render(
      <MemoryRouter initialEntries={["/payments?year=2025&month=5"]}>
        <MonthSelector />
      </MemoryRouter>,
    )

    expect(screen.getByText("Month")).toBeInTheDocument()
  })
})

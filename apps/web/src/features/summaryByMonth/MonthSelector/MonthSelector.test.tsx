import { Theme } from "@radix-ui/themes"
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

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

describe("MonthSelector", () => {
  afterEach(() => {
    cleanup()
    mockNavigate.mockClear()
  })

  test("クエリパラメータがない場合、今月の年月で初期化される", async () => {
    renderWithTheme(
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
    renderWithTheme(
      <MemoryRouter initialEntries={["/payments?year=2025&month=5"]}>
        <MonthSelector />
      </MemoryRouter>,
    )

    expect(screen.getByText("5月")).toBeInTheDocument()
    expect(screen.getByText("2025")).toBeInTheDocument()
  })

  test("年月を選択すると、クエリパラメータが更新される", async () => {
    const user = userEvent.setup()

    renderWithTheme(
      <MemoryRouter initialEntries={["/payments?year=2025&month=5"]}>
        <MonthSelector />
      </MemoryRouter>,
    )

    // 月のボタンをクリック
    const monthButton = screen.getAllByRole("combobox")[0]
    await user.click(monthButton)

    // 6月を選択
    const juneOption = await screen.findByRole("option", { name: "6月" })
    await user.click(juneOption)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/payments?year=2025&month=6")
    })
  })
})

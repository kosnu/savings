import { Theme } from "@radix-ui/themes"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { MonthPicker } from "./MonthPicker"

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

describe("MonthPicker", () => {
  afterEach(() => {
    cleanup()
  })

  test("年月が選択されていない場合、プレースホルダーが表示される", () => {
    renderWithTheme(<MonthPicker />)

    expect(screen.getByText("月を選択")).toBeInTheDocument()
    expect(screen.getByText("年を選択")).toBeInTheDocument()
  })

  test("年月が選択されている場合、選択された値が表示される", () => {
    const date = new Date(2025, 4, 15)
    renderWithTheme(<MonthPicker value={date} />)

    expect(screen.getByText("5月")).toBeInTheDocument()
    expect(screen.getByText("2025")).toBeInTheDocument()
  })

  test("月を選択するとonChangeが呼ばれる", async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    const initialDate = new Date(2025, 4, 15)

    renderWithTheme(<MonthPicker value={initialDate} onChange={handleChange} />)

    // 月のボタンをクリック
    const monthButton = screen.getAllByRole("combobox")[0]
    await user.click(monthButton)

    // 6月を選択
    const juneOption = await screen.findByRole("option", { name: "6月" })
    await user.click(juneOption)

    expect(handleChange).toHaveBeenCalledTimes(1)
    const calledDate = handleChange.mock.calls[0][0]
    expect(calledDate).toBeInstanceOf(Date)
    expect(calledDate.getMonth()).toBe(5) // 6月は0ベースで5
    expect(calledDate.getFullYear()).toBe(2025)
  })

  test("年を選択するとonChangeが呼ばれる", async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    const initialDate = new Date(2025, 4, 15)

    renderWithTheme(<MonthPicker value={initialDate} onChange={handleChange} />)

    // 年のボタンをクリック
    const yearButton = screen.getAllByRole("combobox")[1]
    await user.click(yearButton)

    // 2026年を選択
    const year2026Option = await screen.findByRole("option", { name: "2026" })
    await user.click(year2026Option)

    expect(handleChange).toHaveBeenCalledTimes(1)
    const calledDate = handleChange.mock.calls[0][0]
    expect(calledDate).toBeInstanceOf(Date)
    expect(calledDate.getMonth()).toBe(4) // 5月
    expect(calledDate.getFullYear()).toBe(2026)
  })

  test("id属性が正しく設定される", () => {
    renderWithTheme(<MonthPicker id="month-picker" />)

    const monthButton = screen.getAllByRole("combobox")[0]
    expect(monthButton).toHaveAttribute("id", "month-picker")
  })

  test("name属性が正しく設定される", () => {
    renderWithTheme(<MonthPicker name="month" />)

    const monthButton = screen.getAllByRole("combobox")[0]
    expect(monthButton).toHaveAttribute("name", "month")
  })
})

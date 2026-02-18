import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { MonthPicker } from "./MonthPicker"

describe("MonthPicker", () => {
  afterEach(() => {
    cleanup()
  })

  test("年月が選択されていない場合、プレースホルダーが表示される", () => {
    render(<MonthPicker />)

    const textbox = screen.getByRole("textbox")
    expect(textbox).toHaveValue("")
    expect(textbox).toHaveAttribute("placeholder", "年月を選択")
  })

  test("年月が選択されている場合、フォーマットされた年月が表示される", () => {
    const date = new Date(2025, 4, 15)
    render(<MonthPicker value={date} />)

    const textbox = screen.getByRole("textbox")
    expect(textbox).toHaveValue("2025年5月")
  })

  test("テキストフィールドをクリックするとカレンダーが開く", async () => {
    const user = userEvent.setup()
    render(<MonthPicker />)

    const textbox = screen.getByRole("textbox")
    await user.click(textbox)

    // カレンダーのグリッドが表示されることを確認
    const grid = screen.getByRole("grid")
    expect(grid).toBeInTheDocument()
  })

  test("月を選択するとonChangeが呼ばれる", async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    const initialDate = new Date(2025, 4, 15)

    render(<MonthPicker value={initialDate} onChange={handleChange} />)

    const textbox = screen.getByRole("textbox")
    await user.click(textbox)

    // カレンダーの日付をクリック（現在月の20日をクリック）
    const dayButton = screen.getByRole("button", { name: /2026年2月20日/ })
    await user.click(dayButton)

    expect(handleChange).toHaveBeenCalledTimes(1)
    const calledDate = handleChange.mock.calls[0][0]
    expect(calledDate).toBeInstanceOf(Date)
  })

  test("id属性が正しく設定される", () => {
    render(<MonthPicker id="month-picker" />)

    const textbox = screen.getByRole("textbox")
    expect(textbox).toHaveAttribute("id", "month-picker")
  })

  test("name属性が正しく設定される", () => {
    render(<MonthPicker name="month" />)

    const textbox = screen.getByRole("textbox")
    expect(textbox).toHaveAttribute("name", "month")
  })
})

import { Theme } from "@radix-ui/themes"
import { composeStories } from "@storybook/react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import * as stories from "./MonthPicker.stories"

const { Default, WithValue } = composeStories(stories)

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

describe("MonthPicker", () => {
  afterEach(() => {
    cleanup()
  })

  test("年月が選択されていない場合、プレースホルダーが表示される", () => {
    renderWithTheme(<Default />)

    expect(screen.getByText("月を選択")).toBeInTheDocument()
    expect(screen.getByText("年を選択")).toBeInTheDocument()
  })

  test("年月が選択されている場合、選択された値が表示される", () => {
    renderWithTheme(<WithValue />)

    expect(screen.getByText("5月")).toBeInTheDocument()
    expect(screen.getByText("2025")).toBeInTheDocument()
  })

  test("月を選択するとonChangeが呼ばれる", async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    renderWithTheme(<WithValue onChange={handleChange} />)

    // 月のボタンをクリック
    await user.click(screen.getByRole("combobox", { name: "月" }))

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

    renderWithTheme(<WithValue onChange={handleChange} />)

    // 年のボタンをクリック
    await user.click(screen.getByRole("combobox", { name: "年" }))

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
    renderWithTheme(<Default id="month-picker" />)

    expect(screen.getByRole("combobox", { name: "月" })).toHaveAttribute(
      "id",
      "month-picker",
    )
  })

  test("name属性が正しく設定される", async () => {
    renderWithTheme(
      <form>
        <Default name="month" />
      </form>,
    )

    await waitFor(() => {
      expect(document.querySelector('select[name="month"]')).toBeInTheDocument()
    })
  })
})

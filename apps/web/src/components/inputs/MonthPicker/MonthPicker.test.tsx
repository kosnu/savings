import { Theme } from "@radix-ui/themes"
import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../test/test-utils"
import * as stories from "./MonthPicker.stories"

const { Default, WithValue } = composeStories(stories)

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

describe("MonthPicker", () => {
  test("年月が選択されていない場合、プレースホルダーが表示される", () => {
    renderWithTheme(<Default />)

    expect(screen.getByRole("combobox", { name: "Month" })).toHaveTextContent("Select month")
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent("Select year")
  })

  test("年月が選択されている場合、選択された値が表示される", () => {
    renderWithTheme(<WithValue />)

    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("2025")).toBeInTheDocument()
  })

  test("月を選択するとonChangeが呼ばれる", async () => {
    const handleChange = vi.fn()
    const { user } = renderWithTheme(<WithValue onChange={handleChange} />)

    await user.click(screen.getByRole("combobox", { name: "Month" }))

    const juneOption = await screen.findByRole("option", { name: "6" })
    await user.click(juneOption)

    expect(handleChange).toHaveBeenCalledTimes(1)
    const calledDate = handleChange.mock.calls[0][0]
    expect(calledDate).toBeInstanceOf(Date)
    expect(calledDate.getMonth()).toBe(5) // 6月は0ベースで5
    expect(calledDate.getFullYear()).toBe(2025)
  })

  test("月を選択すると表示も更新される", async () => {
    const { user } = renderWithTheme(<WithValue value={new Date(2025, 2, 1)} />)

    expect(screen.getByText("3")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Month" }))
    await user.click(await screen.findByRole("option", { name: "5" }))

    expect(await screen.findByText("5")).toBeInTheDocument()
  })

  test("年を選択するとonChangeが呼ばれる", async () => {
    const handleChange = vi.fn()
    const { user } = renderWithTheme(<WithValue onChange={handleChange} />)

    await user.click(screen.getByRole("combobox", { name: "Year" }))

    const year2026Option = await screen.findByRole("option", { name: "2026" })
    await user.click(year2026Option)

    expect(handleChange).toHaveBeenCalledTimes(1)
    const calledDate = handleChange.mock.calls[0][0]
    expect(calledDate).toBeInstanceOf(Date)
    expect(calledDate.getMonth()).toBe(4) // 5月
    expect(calledDate.getFullYear()).toBe(2026)
  })
})

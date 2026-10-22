import { Theme } from "@radix-ui/themes"
import { composeStories } from "@storybook/react-vite"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../test/test-utils"
import * as stories from "./MonthPicker.stories"

const { Default, WithValue } = composeStories(stories)

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

afterEach(() => vi.useRealTimers())

describe("MonthPicker", () => {
  test("年月が選択されていない場合、プレースホルダーが表示される", () => {
    renderWithTheme(<Default />)

    expect(screen.getByRole("combobox", { name: "Month" })).toHaveTextContent("Select month")
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent("Select year")
  })

  test("年月が選択されている場合、選択された値が表示される", () => {
    renderWithTheme(<WithValue />)

    expect(screen.getByText("May")).toBeInTheDocument()
    expect(screen.getByText("2025")).toBeInTheDocument()
  })

  test("月を選択するとonChangeが呼ばれる", async () => {
    const handleChange = vi.fn()
    const { user } = renderWithTheme(<WithValue onChange={handleChange} />)

    await user.click(screen.getByRole("combobox", { name: "Month" }))

    const juneOption = await screen.findByRole("option", { name: "June" })
    await user.click(juneOption)

    expect(handleChange).toHaveBeenCalledTimes(1)
    const calledDate = handleChange.mock.calls[0][0]
    expect(calledDate).toBeInstanceOf(Date)
    expect(calledDate.getMonth()).toBe(5) // 6月は0ベースで5
    expect(calledDate.getFullYear()).toBe(2025)
  })

  test("月を選択すると表示も更新される", async () => {
    const { user } = renderWithTheme(<WithValue value={new Date(2025, 2, 1)} />)

    expect(screen.getByText("March")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Month" }))
    await user.click(await screen.findByRole("option", { name: "May" }))

    expect(await screen.findByText("May")).toBeInTheDocument()
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

  test("年の候補を共通の許容範囲に限定する", async () => {
    const { user } = renderWithTheme(<Default />)
    await user.click(screen.getByRole("combobox", { name: "Year" }))

    expect(await screen.findAllByRole("option")).toHaveLength(11)
    expect(screen.getByRole("option", { name: "2022" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "2032" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "2021" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "2033" })).not.toBeInTheDocument()
  })

  test.each([
    [new Date(2021, 11, 31), 2022],
    [new Date(2033, 0, 1), 2032],
  ])("現在時刻 %s が範囲外でも未指定の年月を許容範囲から補完する", async (now, year) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)
    const onChange = vi.fn()
    const { user } = renderWithTheme(<Default onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Month" }))
    await user.click(await screen.findByRole("option", { name: "May" }))
    expect(onChange).toHaveBeenLastCalledWith(new Date(year, 4, 1))
  })

  test.each([
    [new Date(2021, 11, 31), 0],
    [new Date(2033, 0, 1), 11],
  ])("現在時刻 %s が範囲外でも年を先に選択できる", async (now, month) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)
    const onChange = vi.fn()
    const { user } = renderWithTheme(<Default onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Year" }))
    await user.click(await screen.findByRole("option", { name: "2026" }))
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, month, 1))
  })
})

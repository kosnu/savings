import { composeStories } from "@storybook/react-vite"
import { setDefaultOptions } from "date-fns"
import { enUS, ja } from "date-fns/locale"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"

import { render, screen, waitFor } from "../../../test/test-utils"
import * as stories from "./DatePicker.stories"

const { Default, SelectToday } = composeStories(stories)

beforeEach(() => {
  // NOTE: `vi.useFakeTimers()` を使うとPlay Functionを使ったストーリーのテストがタイムアウトしてしまうので、その対応を行なっている
  // https://vitest.dev/api/vi.html#vi-stubglobal
  vi.stubGlobal("jest", {
    advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
  })

  // 時刻のモックを有効化する
  vi.useFakeTimers()
  const mockDate = new Date("2025-05-01T12:00:00+09:00")
  vi.setSystemTime(mockDate)

  setDefaultOptions({ locale: enUS })
})
afterEach(() => {
  // 実際の時刻に戻す
  vi.useRealTimers()

  vi.unstubAllGlobals()
  setDefaultOptions({ locale: ja })
})

test("Select today", async () => {
  // NOTE: `vi.useFakeTimers()` を使うと時間依存の UI が安定しないため、遅延なしの userEvent を使う
  const { user } = render(<SelectToday />, { userOptions: { delay: null } })

  const dateInput = screen.getByRole("textbox")
  await user.click(dateInput)

  const todayButton = await screen.findByRole("button", {
    name: /today/i,
  })

  await user.click(todayButton)

  await waitFor(() => {
    expect(dateInput).toHaveValue("May 1, 2025")
    expect(screen.queryByRole("button", { name: /today/i })).not.toBeInTheDocument()
    expect(dateInput).toHaveFocus()
  })
})

test("入力欄を再クリックすると値を変えずに閉じ、再び開ける", async () => {
  const { user } = render(<SelectToday />, { userOptions: { delay: null } })
  const input = screen.getByRole("textbox")

  await user.click(input)
  expect(await screen.findByRole("grid")).toBeInTheDocument()
  await user.click(input)

  await waitFor(() => expect(screen.queryByRole("grid")).not.toBeInTheDocument())
  expect(input).toHaveValue("May 10, 2025")
  expect(input).toHaveFocus()

  await user.click(input)
  expect(await screen.findByRole("grid")).toBeInTheDocument()
})

test("外側の空白クリックで値を変えずに閉じる", async () => {
  const { user } = render(<SelectToday />, { userOptions: { delay: null } })
  const input = screen.getByRole("textbox")

  await user.click(input)
  expect(await screen.findByRole("grid")).toBeInTheDocument()
  await user.click(document.body)

  await waitFor(() => expect(screen.queryByRole("grid")).not.toBeInTheDocument())
  expect(input).toHaveValue("May 10, 2025")
})

test("外側のボタンをクリックすると閉じ、操作先のフォーカスを保つ", async () => {
  const { user } = render(
    <>
      <SelectToday />
      <button type="button">別の操作</button>
    </>,
    { userOptions: { delay: null } },
  )
  const input = screen.getByRole("textbox")
  const outsideButton = screen.getByRole("button", { name: "別の操作" })

  await user.click(input)
  expect(await screen.findByRole("grid")).toBeInTheDocument()
  await user.click(outsideButton)

  await waitFor(() => expect(screen.queryByRole("grid")).not.toBeInTheDocument())
  expect(input).toHaveValue("May 10, 2025")
  expect(outsideButton).toHaveFocus()
})

test("Escapeで値を変えずに閉じ、入力欄へフォーカスを戻す", async () => {
  const onEscapeKeyDown = vi.fn()
  const { user } = render(<SelectToday onEscapeKeyDown={onEscapeKeyDown} />, {
    userOptions: { delay: null },
  })
  const input = screen.getByRole("textbox")

  await user.click(input)
  expect(await screen.findByRole("grid")).toBeInTheDocument()
  await user.keyboard("{Escape}")

  await waitFor(() => expect(screen.queryByRole("grid")).not.toBeInTheDocument())
  expect(input).toHaveValue("May 10, 2025")
  expect(input).toHaveFocus()
  expect(onEscapeKeyDown).toHaveBeenCalledOnce()
})

test("disabledの入力欄はカレンダーを開かない", async () => {
  const { user } = render(<SelectToday disabled autoFocus />, { userOptions: { delay: null } })
  const input = screen.getByRole("textbox")

  await user.click(input)

  expect(input).toBeDisabled()
  expect(screen.queryByRole("grid")).not.toBeInTheDocument()
})

test("autoFocus のときは初期表示でカレンダーを開く", async () => {
  render(<SelectToday autoFocus />, { userOptions: { delay: null } })

  expect(screen.getByRole("textbox")).toBeInTheDocument()
  expect(await screen.findByRole("button", { name: /today/i })).toBeInTheDocument()
})

test.each([
  {
    value: new Date(2021, 11, 31),
    now: new Date(2025, 4, 1),
    displayedValue: "Dec 31, 2021",
    calendarMonth: "January 2022",
    blockedNavigation: /previous month/i,
    boundaryDay: /January 1st, 2022/,
    selectedDate: new Date(2022, 0, 1),
    selectedValue: "Jan 1, 2022",
  },
  {
    value: new Date(2033, 0, 1),
    now: new Date(2025, 4, 1),
    displayedValue: "Jan 1, 2033",
    calendarMonth: "December 2032",
    blockedNavigation: /next month/i,
    boundaryDay: /December 31st, 2032/,
    selectedDate: new Date(2032, 11, 31),
    selectedValue: "Dec 31, 2032",
  },
  {
    value: undefined,
    now: new Date(2021, 11, 31),
    displayedValue: "",
    calendarMonth: "January 2022",
    blockedNavigation: /previous month/i,
    boundaryDay: /January 1st, 2022/,
    selectedDate: new Date(2022, 0, 1),
    selectedValue: "Jan 1, 2022",
  },
  {
    value: undefined,
    now: new Date(2033, 0, 1),
    displayedValue: "",
    calendarMonth: "December 2032",
    blockedNavigation: /next month/i,
    boundaryDay: /December 31st, 2032/,
    selectedDate: new Date(2032, 11, 31),
    selectedValue: "Dec 31, 2032",
  },
])(
  "範囲外の既存値・現在時刻から $calendarMonth を開き、境界内の日付だけ選択できる（$displayedValue）",
  async ({
    value,
    now,
    displayedValue,
    calendarMonth,
    blockedNavigation,
    boundaryDay,
    selectedDate,
    selectedValue,
  }) => {
    vi.setSystemTime(now)
    const onChange = vi.fn()
    const { user } = render(<Default value={value} onChange={onChange} />, {
      userOptions: { delay: null },
    })
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue(displayedValue)

    await user.click(input)
    expect(await screen.findByRole("grid", { name: calendarMonth })).toBeInTheDocument()
    const blockedButton = screen.getByRole("button", { name: blockedNavigation })
    expect(blockedButton).toHaveAttribute("aria-disabled", "true")
    await user.click(blockedButton)
    expect(screen.getByRole("grid", { name: calendarMonth })).toBeInTheDocument()
    expect(input).toHaveValue(displayedValue)
    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: boundaryDay }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(selectedDate)
    expect(input).toHaveValue(selectedValue)
    expect(screen.queryByRole("grid")).not.toBeInTheDocument()
  },
)

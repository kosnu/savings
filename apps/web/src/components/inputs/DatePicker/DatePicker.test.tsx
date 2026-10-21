import { composeStories } from "@storybook/react-vite"
import { setDefaultOptions } from "date-fns"
import { enUS, ja } from "date-fns/locale"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"

import { render, screen, waitFor } from "../../../test/test-utils"
import * as stories from "./DatePicker.stories"

const { SelectToday } = composeStories(stories)

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

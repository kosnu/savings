import { composeStories } from "@storybook/react-vite"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setDefaultOptions } from "date-fns"
import { enUS, ja } from "date-fns/locale"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import * as stories from "./DatePicker.stories"

const { Default } = composeStories(stories)

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
  // NOTE: `vi.useFakeTimers()` を使うとPlay Functionを使ったストーリーのテストがタイムアウトしてしまうので、その対応を行なっている
  const customUserEvent = userEvent.setup({ delay: null })
  await Default.run()

  const dateInput = screen.getByRole("textbox")
  await customUserEvent.click(dateInput)

  const todayButton = await screen.findByRole("button", {
    name: /今日/i,
  })

  await customUserEvent.click(todayButton)

  await waitFor(() => {
    expect(dateInput).toHaveValue("2025/05/01")
    expect(
      screen.queryByRole("button", { name: /今日/i }),
    ).not.toBeInTheDocument()
  })
})

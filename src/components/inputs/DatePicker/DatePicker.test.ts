import { composeStories } from "@storybook/react"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
})
afterEach(() => {
  // 実際の時刻に戻す
  vi.useRealTimers()

  vi.unstubAllGlobals()
})

test("Select today", async () => {
  // NOTE: `vi.useFakeTimers()` を使うとPlay Functionを使ったストーリーのテストがタイムアウトしてしまうので、その対応を行なっている
  const customUserEvent = userEvent.setup({ delay: null })
  await Default.run()

  const button = screen.getByRole("button", {
    name: /date/i,
  })
  await customUserEvent.click(button)

  const todayButton = await screen.findByRole("button", {
    name: /today/i,
  })

  await customUserEvent.click(todayButton)

  expect(button).toHaveTextContent("2025/05/01")
})

import { composeStories } from "@storybook/react"
import { screen } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import * as stories from "./DatePicker.stories"

const { SelectToday } = composeStories(stories)

test("Select today", async () => {
  // Mock the current date to 2025-05-01
  const mockDate = new Date("2025-05-01T12:00:00+09:00")
  vi.setSystemTime(mockDate)

  await SelectToday.run()

  const button = screen.getByRole("button", {
    name: /date/i,
  })
  expect(button).toHaveTextContent("2025/05/01")
})

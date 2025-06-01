import { composeStories } from "@storybook/react-vite"
import { screen } from "@testing-library/react"
import { expect } from "storybook/test"
import { afterEach, beforeEach, test, vi } from "vitest"
import * as stories from "./MoneyCard.stories"

const { HasError } = composeStories(stories)
const originalConsoleError = console.error

beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  vi.clearAllMocks()
})

test("When errror occured", async () => {
  await HasError.run()

  expect(
    await screen.findByText("An unexpected error has occurred."),
  ).toBeInTheDocument()
})

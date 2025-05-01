import { composeStories } from "@storybook/react"
import { expect } from "@storybook/test"
import { screen } from "@testing-library/react"
import { test } from "vitest"
import * as stories from "./DatePicker.stories"

const { Filled } = composeStories(stories)

test("Filled", async () => {
  // Mock the current date to 2025-05-01
  await Filled.run()

  const button = screen.getByRole("button", {
    name: /date/i,
  })
  expect(button).toHaveTextContent("2025/05/01")
})

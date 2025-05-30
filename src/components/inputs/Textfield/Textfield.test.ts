import { composeStories } from "@storybook/react-vite"
import { screen } from "@testing-library/react"
import { expect } from "storybook/test"
import { test } from "vitest"
import * as stories from "./Textfield.stories"

const { Filled } = composeStories(stories)

test("Checks if the form is valid", async () => {
  await Filled.run()

  expect(screen.getByRole("textbox")).toHaveValue()
})

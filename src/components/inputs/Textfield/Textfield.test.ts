import { composeStories } from "@storybook/react"
import { expect } from "@storybook/test"
import { screen } from "@testing-library/react"
import { test } from "vitest"
import * as stories from "./Textfield.stories"

const { Filled } = composeStories(stories)

test("Checks if the form is valid", async () => {
  await Filled.run()

  expect(screen.getByRole("textbox")).toHaveValue()
})

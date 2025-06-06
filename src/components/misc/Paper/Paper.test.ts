import { composeStories } from "@storybook/react-vite"
import { screen } from "@testing-library/react"
import { expect } from "storybook/test"
import { test } from "vitest"
import * as stories from "./Paper.stories"

const { Default } = composeStories(stories)

test("Checks if the Paper component renders correctly", async () => {
  await Default.run()

  expect(screen.getByText("Paper")).toBeInTheDocument()
})

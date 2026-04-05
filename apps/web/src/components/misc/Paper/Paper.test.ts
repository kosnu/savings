import { composeStories } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { test } from "vitest"

import { screen } from "../../../test/test-utils"
import * as stories from "./Paper.stories"

const { Default } = composeStories(stories)

test("Checks if the Paper component renders correctly", async () => {
  await Default.run()

  expect(screen.getByText("Paper")).toBeInTheDocument()
})

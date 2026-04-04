import { composeStories } from "@storybook/react-vite"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import * as stories from "./Snackbar.stories"

const { Default } = composeStories(stories)

describe("Snackbar", () => {
  test("open ボタンを押すと snackbar が表示される", async () => {
    const user = userEvent.setup()

    render(<Default duration={60_000} />)

    await user.click(screen.getByRole("button", { name: "Open snackbar" }))

    expect(await screen.findByText("This is a message")).toBeInTheDocument()
  })
})

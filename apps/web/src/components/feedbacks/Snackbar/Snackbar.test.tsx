import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vite-plus/test"

import { render, screen } from "../../../test/test-utils"
import * as stories from "./Snackbar.stories"

const { Default } = composeStories(stories)

describe("Snackbar", () => {
  test("open ボタンを押すと snackbar が表示される", async () => {
    const { user } = render(<Default duration={60_000} />)

    await user.click(screen.getByRole("button", { name: "Open snackbar" }))

    expect(await screen.findByText("This is a message")).toBeInTheDocument()
  })

  test("info snackbar は中立色を使う", async () => {
    const { user } = render(<Default duration={60_000} />)

    await user.click(screen.getByRole("button", { name: "Open snackbar" }))

    const message = await screen.findByText("This is a message")

    expect(message.closest("[data-accent-color]")).toHaveAttribute("data-accent-color", "gray")
  })
})

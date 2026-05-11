import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../test/test-utils"
import * as stories from "./ErrorPage.stories"

const { Default } = composeStories(stories)

describe("ErrorPage", () => {
  test("汎用エラー表示と復帰導線を表示する", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<Default />, { withProviders: false })

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument()
    expect(
      screen.getByText("The page could not be displayed. Try reloading the page, or go back home."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/")
    expect(screen.queryByText("Storybook root error")).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error))

    consoleError.mockRestore()
  })
})

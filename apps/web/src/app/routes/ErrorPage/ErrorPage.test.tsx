import { createRoute } from "@tanstack/react-router"
import { describe, expect, test, vi } from "vite-plus/test"

import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { screen, waitFor } from "../../../test/test-utils"
import { ErrorPage } from "./ErrorPage"
import * as stories from "./ErrorPage.stories"

const defaultArgs = stories.Default.args

function renderDefaultStory() {
  return renderWithRouter(
    "/",
    (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/",
        component: () => (
          <ErrorPage
            error={defaultArgs?.error ?? new Error("Storybook root error")}
            info={defaultArgs?.info ?? { componentStack: "" }}
            reset={defaultArgs?.reset ?? vi.fn()}
          />
        ),
      }),
    ],
    { withProviders: false },
  )
}

describe("ErrorPage", () => {
  test("汎用エラー表示と復帰導線を表示する", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    renderDefaultStory()

    expect(await screen.findByRole("heading", { name: "Something went wrong" })).toBeInTheDocument()
    expect(
      screen.getByText("The page could not be displayed. Try reloading the page, or go back home."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/")
    expect(screen.queryByText("Storybook root error")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(expect.any(Error))
    })

    consoleError.mockRestore()
  })
})

import { composeStories } from "@storybook/react-vite"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import * as stories from "./SubmitButton.stories"

const { Default, Loading } = composeStories(stories)

describe("SubmitButton", () => {
  test("Default story では submit ボタンを表示する", () => {
    render(
      <form>
        <Default />
      </form>,
    )

    expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled()
  })

  test("Loading story では spinner を表示して無効化する", () => {
    render(
      <form>
        <Loading />
      </form>,
    )

    const button = screen.getByRole("button", { name: /submit/i })
    expect(button).toBeDisabled()
    expect(screen.getByLabelText("loading-spinner")).toBeInTheDocument()
  })
})

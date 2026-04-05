import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./AmountInput.stories"

const { Default, Filled } = composeStories(stories)

describe("AmountInput", () => {
  test("入力すると値が更新される", async () => {
    const { user } = render(<Default />)

    const input = screen.getByRole("textbox")
    await user.type(input, "1000")

    expect(input).toHaveValue("1000")
  })

  test("初期値を表示する", () => {
    render(<Filled />)

    expect(screen.getByRole("textbox")).toHaveValue("1200")
  })
})

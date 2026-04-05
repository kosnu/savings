import { composeStories } from "@storybook/react-vite"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./NoteInput.stories"

const { Default, Filled } = composeStories(stories)

describe("NoteInput", () => {
  test("入力すると値が更新される", async () => {
    const user = userEvent.setup()

    render(<Default />)

    const input = screen.getByRole("textbox")
    await user.type(input, "This is a note")

    expect(input).toHaveValue("This is a note")
  })

  test("初期値を表示する", () => {
    render(<Filled />)

    expect(screen.getByRole("textbox")).toHaveValue("Existing note")
  })
})

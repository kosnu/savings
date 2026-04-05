import { composeStories } from "@storybook/react-vite"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./NoteField.stories"

const { Default, HasError } = composeStories(stories)

describe("CreatePayment NoteField", () => {
  test("Default story では入力値を更新できる", async () => {
    const user = userEvent.setup()

    render(<Default />)

    const textfield = screen.getByRole("textbox", { name: /note/i })
    await user.type(textfield, "This is a note")

    expect(textfield).toHaveValue("This is a note")
  })

  test("HasError story ではエラーメッセージを表示する", () => {
    render(<HasError />)

    expect(screen.getByText("This field is required")).toBeInTheDocument()
  })
})

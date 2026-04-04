import { composeStories } from "@storybook/react-vite"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import * as stories from "./AmountField.stories"

const { Default, HasError } = composeStories(stories)

describe("CreatePayment AmountField", () => {
  test("Default story では入力値を更新できる", async () => {
    const user = userEvent.setup()

    render(<Default />)

    const textfield = screen.getByRole("textbox", { name: /amount/i })
    await user.type(textfield, "1000")

    expect(textfield).toHaveValue("1000")
  })

  test("HasError story ではエラーメッセージを表示する", () => {
    render(<HasError />)

    expect(screen.getByText("This field is required")).toBeInTheDocument()
  })
})

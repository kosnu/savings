import { composeStories } from "@storybook/react-vite"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import * as stories from "./EditableField.stories"

const { Default, Editing, WithMessages } = composeStories(stories)

describe("EditableField", () => {
  test("表示モードではラベルと編集ボタンを表示する", () => {
    render(<Default />)

    expect(screen.getByText("Amount")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit amount/i })).toBeInTheDocument()
  })

  test("編集モードでは入力欄を表示する", () => {
    render(<Editing />)

    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("編集を開始するとメッセージを表示する", async () => {
    const user = userEvent.setup()

    render(<WithMessages />)

    await user.click(screen.getByRole("button", { name: /edit amount/i }))

    expect(screen.getByText("Failed to update amount.")).toBeInTheDocument()
  })
})

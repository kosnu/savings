import { Theme } from "@radix-ui/themes"
import { composeStories } from "@storybook/react-vite"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"

import * as stories from "./CategorySelect.stories"

const { AllowEmptyOption, Empty, EmptyWithAllowEmptyOption } = composeStories(stories)

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

describe("CategorySelect", () => {
  afterEach(() => {
    cleanup()
  })

  test("allowEmptyOption が false のとき空文字は未選択として扱う", async () => {
    const user = userEvent.setup()

    renderWithTheme(<Empty />)

    const combobox = screen.getByRole("combobox")
    expect(combobox).toHaveTextContent("Pick a category")

    await user.click(combobox)

    expect(screen.queryByRole("option", { name: /^none$/i })).not.toBeInTheDocument()
  })

  test("allowEmptyOption が true のとき空文字は None を選択値にする", () => {
    renderWithTheme(<EmptyWithAllowEmptyOption />)

    expect(screen.getByRole("combobox")).toHaveTextContent("None")
  })

  test("none を選ぶと空文字へ変換して通知する", async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    renderWithTheme(<AllowEmptyOption onChange={handleChange} />)

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: /^none$/i }))

    expect(handleChange).toHaveBeenCalledWith("")
    expect(screen.getByRole("combobox")).toHaveTextContent("None")
  })
})

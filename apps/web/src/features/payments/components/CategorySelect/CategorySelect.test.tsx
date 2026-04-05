import { Theme } from "@radix-ui/themes"
import { composeStories } from "@storybook/react-vite"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./CategorySelect.stories"

const { AllowEmptyOption, Default, Empty, EmptyWithAllowEmptyOption, ErrorState, Filled, Loading } =
  composeStories(stories)

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

describe("CategorySelect", () => {
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

  test("Default story では category option を展開できる", async () => {
    const user = userEvent.setup()

    renderWithTheme(<Default />)

    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: /food/i })).toBeInTheDocument()
  })

  test("Filled story では選択済みラベルが表示される", () => {
    renderWithTheme(<Filled />)

    expect(screen.getByRole("combobox")).toHaveTextContent("Daily Necessities")
  })

  test("Loading story では loading option を表示する", async () => {
    const user = userEvent.setup()

    renderWithTheme(<Loading />)

    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: /loading/i })).toBeInTheDocument()
  })

  test("ErrorState story では error option を表示する", async () => {
    const user = userEvent.setup()

    renderWithTheme(<ErrorState />)

    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: /error/i })).toBeInTheDocument()
  })
})

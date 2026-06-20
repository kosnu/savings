import { Theme } from "@radix-ui/themes"
import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../../test/test-utils"
import type { Category } from "../../../../types/category"
import { CategoryOption, CategorySelect } from "./CategorySelect"
import * as stories from "./CategorySelect.stories"

import styles from "./CategorySelect.module.css"

const { Default, Empty, ErrorState, Filled, Loading } = composeStories(stories)

const renderWithTheme = (component: React.ReactElement) => {
  return render(<Theme>{component}</Theme>)
}

describe("CategorySelect", () => {
  test("空文字は None を選択値にする", () => {
    renderWithTheme(<Empty />)

    expect(screen.getByRole("combobox")).toHaveTextContent("None")
    expect(screen.getByRole("combobox")).toHaveClass(styles.systemLabel)
    expect(screen.queryByText("No category")).not.toBeInTheDocument()
  })

  test("none を選ぶと空文字へ変換して通知する", async () => {
    const handleChange = vi.fn()
    const { user } = renderWithTheme(<Filled onChange={handleChange} />)

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: /^none$/i }))

    expect(handleChange).toHaveBeenCalledWith("")
    expect(screen.getByRole("combobox")).toHaveTextContent("None")
    expect(screen.getByRole("combobox")).toHaveClass(styles.systemLabel)
    expect(screen.queryByText("No category")).not.toBeInTheDocument()
  })

  test("実在カテゴリ名 None と未選択状態の None を区別できる", async () => {
    const noneCategory: Category = {
      id: 999,
      bookId: 1,
      name: "None",
      createdDate: new Date(),
      updatedDate: new Date(),
    }
    const { user } = renderWithTheme(
      <CategorySelect>
        <CategoryOption category={noneCategory} />
      </CategorySelect>,
    )

    await user.click(screen.getByRole("combobox"))

    const noneOptions = screen.getAllByRole("option", { name: /^none$/i })
    expect(noneOptions).toHaveLength(2)
    expect(noneOptions[0]).toHaveClass(styles.systemLabel)
    expect(noneOptions[1]).not.toHaveClass(styles.systemLabel)
    expect(screen.queryByText("No category")).not.toBeInTheDocument()
  })

  test("Default story では category option を展開できる", async () => {
    const { user } = renderWithTheme(<Default />)

    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: /food/i })).toBeInTheDocument()
  })

  test("Filled story では選択済みラベルが表示される", () => {
    renderWithTheme(<Filled />)

    expect(screen.getByRole("combobox")).toHaveTextContent("Daily Necessities")
  })

  test("disabled prop で combobox を操作不可にする", () => {
    renderWithTheme(<Default disabled />)

    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  test("Loading story では loading option を表示する", async () => {
    const { user } = renderWithTheme(<Loading />)

    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: /loading/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  test("ErrorState story では error option を表示する", async () => {
    const { user } = renderWithTheme(<ErrorState />)

    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: /error/i })).toHaveAttribute("aria-disabled", "true")
  })
})

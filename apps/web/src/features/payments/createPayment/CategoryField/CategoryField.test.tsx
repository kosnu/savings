import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vitest"

import { render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./CategoryField.stories"

const { Default } = composeStories(stories)

function renderStory(story: React.ReactElement) {
  return render(story)
}

describe("CreatePayment CategoryField", () => {
  test("Default story ではカテゴリ入力欄を表示する", async () => {
    renderStory(<Default />)

    expect(await screen.findByRole("combobox", { name: /category/i })).toBeInTheDocument()
  })

  test("カテゴリを選択できる", async () => {
    const onChange = vi.fn()
    const { user } = renderStory(<Default onChange={onChange} />)

    const select = await screen.findByRole("combobox", { name: /category/i })
    await user.click(select)

    const listbox = await screen.findByRole("listbox")
    await waitFor(() => {
      expect(within(listbox).queryByLabelText(/loading/i)).not.toBeInTheDocument()
    })

    const option = await within(listbox).findByRole("option", { name: /food/i })
    await user.click(option)

    expect(onChange).toHaveBeenCalledWith("10")
    expect(screen.getByRole("combobox")).toHaveTextContent("Food")
  })
})

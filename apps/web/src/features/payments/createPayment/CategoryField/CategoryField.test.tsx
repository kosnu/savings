import { Theme } from "@radix-ui/themes"
import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { createQueryClient } from "../../../../lib/queryClient"
import * as stories from "./CategoryField.stories"

const { Default } = composeStories(stories)

function renderStory(story: React.ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Theme>{story}</Theme>
    </QueryClientProvider>,
  )
}

describe("CreatePayment CategoryField", () => {
  test("Default story ではカテゴリ入力欄を表示する", async () => {
    renderStory(<Default />)

    expect(await screen.findByRole("combobox", { name: /category/i })).toBeInTheDocument()
  })

  test("カテゴリを選択できる", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    renderStory(<Default onChange={onChange} />)

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

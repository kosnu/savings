import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../test/test-utils"
import * as stories from "./Header.stories"

const { Default } = composeStories(stories)

describe("Header", () => {
  test("メニューボタンを押すと onMenuClick が呼ばれ、Burneto の支払いリンクを表示する", async () => {
    const onMenuClick = vi.fn()
    const { user } = render(<Default onMenuClick={onMenuClick} />)

    await user.click(await screen.findByLabelText("Menu button"))

    expect(onMenuClick).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("link", { name: "Burneto — Payments" })).toHaveAttribute(
      "href",
      "/payments",
    )
  })
})

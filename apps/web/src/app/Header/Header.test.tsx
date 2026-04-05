import { composeStories } from "@storybook/react-vite"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { render, screen } from "../../test/test-utils"
import * as stories from "./Header.stories"

const { Default } = composeStories(stories)

describe("Header", () => {
  test("メニューボタンを押すと onMenuClick が呼ばれ、Logo button を表示する", async () => {
    const user = userEvent.setup()
    const onMenuClick = vi.fn()
    render(<Default onMenuClick={onMenuClick} />)

    await user.click(await screen.findByLabelText("Menu button"))

    expect(onMenuClick).toHaveBeenCalledTimes(1)
    expect(await screen.findByLabelText("Logo button")).toBeInTheDocument()
  })
})

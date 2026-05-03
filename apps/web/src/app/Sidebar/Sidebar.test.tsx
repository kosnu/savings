import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../test/test-utils"
import * as stories from "./Sidebar.stories"

const { Default, Closed } = composeStories(stories)

describe("Sidebar", () => {
  test("Default story では開いたサイドバーを表示する", async () => {
    render(<Default />)

    const sidebar = await screen.findByRole("complementary")
    expect(await screen.findByText("My Savings")).toBeInTheDocument()
    expect(await screen.findByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "true")
  })

  test("Closed story では閉じた状態を表示する", async () => {
    render(<Closed />)

    const sidebar = await screen.findByRole("complementary")
    expect(await screen.findByText("My Savings")).toBeInTheDocument()
    expect(await screen.findByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "false")
  })

  test("開いている状態でサイドバー領域外をクリックすると onClose を呼ぶ", async () => {
    const onClose = vi.fn()
    const { user } = render(<Default onClose={onClose} />)

    await user.click(await screen.findByTestId("sidebar-backdrop"))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("サイドバー内をクリックしても領域外クリックとして onClose を呼ばない", async () => {
    const onClose = vi.fn()
    const { user } = render(<Default onClose={onClose} />)

    await user.click(await screen.findByText("Sidebar Content"))

    expect(onClose).not.toHaveBeenCalled()
  })

  test("閉じている状態では領域外クリック用の backdrop を表示しない", async () => {
    const onClose = vi.fn()
    render(<Closed onClose={onClose} />)

    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})

import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

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
})

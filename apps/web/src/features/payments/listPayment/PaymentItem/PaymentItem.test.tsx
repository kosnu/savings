import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./PaymentItem.stories"

const { Default, WithoutCategory } = composeStories(stories)

describe("PaymentItem", () => {
  test("支払い行にカテゴリ、日付、金額が表示され、button として操作できる", async () => {
    const onOpen = vi.fn()
    const { user } = render(<Default onOpen={onOpen} />)

    expect(screen.getByText("コンビニ")).toBeInTheDocument()
    expect(screen.getByText("Food")).toBeInTheDocument()
    expect(screen.getByText("Jun 2, 2025")).toBeInTheDocument()
    expect(screen.getByText("¥1,000")).toBeInTheDocument()
    const trigger = screen.getByRole("button", { name: /コンビニ/ })
    expect(trigger).toBeInTheDocument()

    await user.click(trigger)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(trigger)
  })

  test("未分類の支払い行はカテゴリバッジを表示しない", async () => {
    const onOpen = vi.fn()
    const { user } = render(<WithoutCategory onOpen={onOpen} />)

    expect(screen.getByText("コンビニ")).toBeInTheDocument()
    expect(screen.getByText("Jun 2, 2025")).toBeInTheDocument()
    expect(screen.getByText("¥1,000")).toBeInTheDocument()
    expect(screen.queryByText("Food")).not.toBeInTheDocument()
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument()

    const trigger = screen.getByRole("button", { name: "Jun 2, 2025 コンビニ ¥1,000" })
    await user.click(trigger)

    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

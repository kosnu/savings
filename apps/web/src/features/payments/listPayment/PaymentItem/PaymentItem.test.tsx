import { composeStories } from "@storybook/react-vite"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./PaymentItem.stories"

const { Default } = composeStories(stories)

describe("PaymentItem", () => {
  test("支払い行にカテゴリ、日付、金額が表示され、button として操作できる", async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()

    render(<Default onOpen={onOpen} />)

    expect(screen.getByText("コンビニ")).toBeInTheDocument()
    expect(screen.getByText("Food")).toBeInTheDocument()
    expect(screen.getByText("2025/06/02")).toBeInTheDocument()
    expect(screen.getByText("￥1,000")).toBeInTheDocument()
    const trigger = screen.getByRole("button", { name: /コンビニ/ })
    expect(trigger).toBeInTheDocument()

    await user.click(trigger)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(trigger)
  })
})

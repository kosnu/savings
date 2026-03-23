import { composeStories } from "@storybook/react-vite"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import * as stories from "./PaymentItem.stories"

const { Default } = composeStories(stories)

describe("PaymentItem", () => {
  test("支払い行にカテゴリが表示され、button として操作できる", () => {
    render(<Default />)

    expect(screen.getByText("Food")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /コンビニ/ })).toBeInTheDocument()
  })
})

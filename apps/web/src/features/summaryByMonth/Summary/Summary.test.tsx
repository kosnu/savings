import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen } from "../../../test/test-utils"
import * as stories from "./Summary.stories"

const { Default } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

describe("Summary", () => {
  test("月次合計とカテゴリ別合計を表示できる", async () => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
    const { user } = renderStory()

    expect(await screen.findByText("Total spending")).toBeInTheDocument()
    expect(await screen.findByText("￥5,000")).toBeInTheDocument()

    const accordionTrigger = screen.getByRole("button", {
      name: /by category/i,
    })
    await user.click(accordionTrigger)

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
  })
})

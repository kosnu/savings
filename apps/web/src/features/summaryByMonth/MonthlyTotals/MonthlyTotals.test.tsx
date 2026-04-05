import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen } from "../../../test/test-utils"
import * as stories from "./MonthlyTotals.stories"

const { Default } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

describe("MonthlyTotals", () => {
  test("月次合計を表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        getMonthlyTotalAmount: { response: 10000 },
      }),
    )
    renderStory()

    expect(await screen.findByText("Total spending")).toBeInTheDocument()
    expect(await screen.findByText("￥10,000")).toBeInTheDocument()
  })
})

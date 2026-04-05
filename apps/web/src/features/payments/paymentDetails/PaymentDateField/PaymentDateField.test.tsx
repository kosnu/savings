import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./PaymentDateField.stories"

const { Default } = composeStories(stories)

describe("PaymentDetails PaymentDateField", () => {
  test("Default story ではラベルと日付を表示する", () => {
    render(<Default />)

    expect(screen.getByText("Date")).toBeInTheDocument()
    expect(screen.getByText("2025/06/02")).toBeInTheDocument()
  })
})

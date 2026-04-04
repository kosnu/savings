import { composeStories } from "@storybook/react-vite"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import * as stories from "./CategoryField.stories"

const { Default } = composeStories(stories)

describe("PaymentDetails CategoryField", () => {
  test("Default story ではラベルとカテゴリ名を表示する", () => {
    render(<Default />)

    expect(screen.getByText("Category")).toBeInTheDocument()
    expect(screen.getByText("Food")).toBeInTheDocument()
  })
})

import { composeStories } from "@storybook/react-vite"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import * as stories from "./PaymentDetailsOverlay.stories"

const { EmptyNote } = composeStories(stories)

describe("PaymentDetailsOverlay", () => {
  test("note が空でも値領域を維持してプレースホルダを表示する", async () => {
    render(<EmptyNote />)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })

    expect(within(dialog).getByText("No note")).toBeInTheDocument()
    expect(within(dialog).getAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })
})

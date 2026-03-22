import { composeStories } from "@storybook/react-vite"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"

import * as stories from "./CreatePaymentModal.stories"

const { Default } = composeStories(stories)

describe("CreatePaymentModal", () => {
  afterEach(() => {
    cleanup()
  })

  test("should stay open when Escape is pressed", async () => {
    const user = userEvent.setup()

    render(<Default />)

    await user.click(screen.getByRole("button", { name: /create payment/i }))

    const dialog = await screen.findByRole("dialog", { name: /create payment/i })
    expect(dialog).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(screen.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()
  })

  test("should close when Cancel is clicked", async () => {
    const user = userEvent.setup()

    render(<Default />)

    await user.click(screen.getByRole("button", { name: /create payment/i }))
    await screen.findByRole("dialog", { name: /create payment/i })

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(screen.queryByRole("dialog", { name: /create payment/i })).not.toBeInTheDocument()
  })
})

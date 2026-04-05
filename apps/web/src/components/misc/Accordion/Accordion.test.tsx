import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { render, screen, waitFor } from "../../../test/test-utils"
import * as stories from "./Accordion.stories"

const { Default, Multiple } = composeStories(stories)

describe("Accordion", () => {
  test("single accordion は開閉できる", async () => {
    const { user } = render(<Default />)

    await user.click(screen.getByRole("button", { name: /is it accessible\?/i }))

    expect(
      await screen.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        /Yes. It's unstyled by default, giving you freedom over the look and feel./i,
      ),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /is it unstyled\?/i }))

    await waitFor(() => {
      expect(
        screen.queryByText(/Yes. It adheres to the WAI-ARIA design pattern./i),
      ).not.toBeInTheDocument()
    })
    expect(
      await screen.findByText(
        /Yes. It's unstyled by default, giving you freedom over the look and feel./i,
      ),
    ).toBeInTheDocument()
  })

  test("multiple accordion は複数開ける", async () => {
    const { user } = render(<Multiple />)

    await user.click(screen.getByRole("button", { name: /is it accessible\?/i }))
    expect(
      await screen.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /is it unstyled\?/i }))

    expect(
      await screen.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(
        /Yes. It's unstyled by default, giving you freedom over the look and feel./i,
      ),
    ).toBeInTheDocument()
  })
})

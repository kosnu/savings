import { composeStories } from "@storybook/react-vite"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import * as stories from "./NoteField.stories"

const { Default, EmptyNote } = composeStories(stories)

describe("PaymentDetails NoteField", () => {
  test("Default story ではラベルとノートを表示する", () => {
    render(<Default />)

    expect(screen.getByText("Note")).toBeInTheDocument()
    expect(screen.getByText("コンビニ")).toBeInTheDocument()
  })

  test("EmptyNote story ではプレースホルダーを表示する", () => {
    render(<EmptyNote />)

    expect(screen.getByText("No note")).toBeInTheDocument()
  })
})

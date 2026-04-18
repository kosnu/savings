import { describe, expect, test } from "vitest"

import { render, screen } from "../../../test/test-utils"
import { BudgetsPage } from "./BudgetsPage"

describe("BudgetsPage", () => {
  test("Budgets 見出しを表示する", () => {
    render(<BudgetsPage />)

    expect(screen.getByRole("heading", { name: "Budgets" })).toBeInTheDocument()
  })
})

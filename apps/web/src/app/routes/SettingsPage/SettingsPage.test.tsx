import { describe, expect, test } from "vitest"

import { render, screen } from "../../../test/test-utils"
import { SettingsPage } from "./SettingsPage"

describe("SettingsPage", () => {
  test("Settings 見出しを表示する", () => {
    render(<SettingsPage />)

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
  })
})

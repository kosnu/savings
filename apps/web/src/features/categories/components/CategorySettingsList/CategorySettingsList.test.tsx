import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vite-plus/test"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./CategorySettingsList.stories"

const { Default } = composeStories(stories)

describe("CategorySettingsList", () => {
  test("カテゴリ設定の列構造を表示する", () => {
    render(<Default />)

    expect(screen.getByText("Categories")).toBeInTheDocument()
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Monthly budget")).toBeInTheDocument()
    expect(screen.getByText("Pin")).toBeInTheDocument()
  })
})

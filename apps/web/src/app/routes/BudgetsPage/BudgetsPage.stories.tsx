import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { BudgetsPage } from "./BudgetsPage"

const meta = {
  title: "Pages/BudgetsPage",
  component: BudgetsPage,
  parameters: {},
  tags: ["autodocs", "browser-test"],
  decorators: [createStoryRouter("/budgets")],
  argTypes: {},
  args: {},
} satisfies Meta<typeof BudgetsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("heading", { name: "Budgets" })).toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { MonthSelector } from "./MonthSelector"

const meta = {
  title: "Features/SummaryByMonth/MonthSelector",
  component: MonthSelector,
  parameters: {
    layout: "centered",
    mockingDate: new Date(2025, 4, 15),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MonthSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [createStoryRouter("/payments?year=2025&month=5")],
}

export const WithoutQueryParams: Story = {
  decorators: [createStoryRouter("/payments")],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { MonthSelector } from "./MonthSelector"

const meta = {
  title: "Features/SummaryByMonth/MonthSelector",
  component: MonthSelector,
  parameters: {
    layout: "centered",
    mockingDate: new Date(2025, 4, 15),
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/payments?year=2025&month=5"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof MonthSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutQueryParams: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/payments"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, within } from "storybook/test"
import { Sidebar } from "./Sidebar"

const meta = {
  title: "Shared/Sidebar/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  argTypes: {
    open: { control: "boolean" },
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    children: "Sidebar Content",
  },
  play: async ({ canvasElement }) => {
    const sidebar = within(canvasElement).getByRole("complementary")

    expect(within(sidebar).getByText("My Savings")).toBeInTheDocument()
    expect(within(sidebar).getByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "true")
  },
}

export const Closed: Story = {
  args: {
    open: false,
    children: "Sidebar Content",
  },
  play: async ({ canvasElement }) => {
    const sidebar = within(canvasElement).getByRole("complementary")

    expect(within(sidebar).getByText("My Savings")).toBeInTheDocument()
    expect(within(sidebar).getByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "false")
  },
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, fn, within } from "storybook/test"
import { Header } from "./Header"

const meta = {
  title: "Shared/Header",
  component: Header,
  tags: ["autodocs"],
  args: {
    onMenuClick: fn(),
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof Header>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByLabelText("Menu button"))
    expect(args.onMenuClick).toBeCalledTimes(1)

    expect(canvas.getByLabelText("Logo button")).toBeInTheDocument()
  },
}

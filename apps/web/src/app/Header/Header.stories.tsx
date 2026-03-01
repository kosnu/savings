import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, within } from "storybook/test"
import { createStoryRouter } from "../../test/helpers/routerDecorator"
import { Header } from "./Header"

const meta = {
  title: "Shared/Header",
  component: Header,
  tags: ["autodocs"],
  args: {
    onMenuClick: fn(),
  },
  decorators: [createStoryRouter("/")],
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

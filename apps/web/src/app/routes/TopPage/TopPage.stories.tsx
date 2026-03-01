import type { Meta, StoryObj } from "@storybook/react-vite"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { TopPage } from "./TopPage"

const meta = {
  title: "Pages/TopPage",
  component: TopPage,
  parameters: {},
  tags: ["autodocs"],
  decorators: [createStoryRouter("/")],
  argTypes: {},
  args: {},
} satisfies Meta<typeof TopPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

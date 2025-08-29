import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Aggregates } from "./Aggregates"

const meta = {
  title: "Features/Aggregates/Aggregates",
  component: Aggregates,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  decorators: (Story) => {
    return (
      <Container size="4">
        <Story />
      </Container>
    )
  },
} satisfies Meta<typeof Aggregates>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

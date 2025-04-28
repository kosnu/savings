import type { Meta, StoryObj } from "@storybook/react"
import { Container } from "./Container"

const meta = {
  title: "Common/Layouts/Container",
  component: Container,
  parameters: {},
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  render: (args) => {
    return (
      <Container {...args}>
        <p>Container size is {args.size}</p>
      </Container>
    )
  },
} satisfies Meta<typeof Container>

export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = {
  args: {
    size: "small",
  },
}

export const Medium: Story = {
  args: {
    size: "medium",
  },
}

export const Large: Story = {
  args: {
    size: "large",
  },
}

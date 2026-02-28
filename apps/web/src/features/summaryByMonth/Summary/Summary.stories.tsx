import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, waitForElementToBeRemoved } from "storybook/test"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { Summary } from "./Summary"

const meta = {
  title: "Features/SummaryByMonth/Summary",
  component: Summary,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  decorators: [
    createStoryRouter("/payments?year=2025&month=06"),
    (Story) => (
      <Container size="4">
        <Story />
      </Container>
    ),
  ],
} satisfies Meta<typeof Summary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    await waitForElementToBeRemoved(() => canvas.queryByTestId("skeleton"))

    expect(await canvas.findByText("Total spending")).toBeInTheDocument()
    expect(await canvas.findByText("￥10,000")).toBeInTheDocument()

    const accordionTrigger = canvas.getByRole("button", {
      name: /by category/i,
    })
    expect(accordionTrigger).toBeInTheDocument()
    await userEvent.click(accordionTrigger)

    expect(await canvas.findByText("Food")).toBeInTheDocument()
    expect(await canvas.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await canvas.findByText("Entertainment")).toBeInTheDocument()
  },
}

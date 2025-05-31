import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect } from "storybook/test"
import { FiresotreTestProvider } from "../../../utils/firebase/FirebaseTestProvider"
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
  decorators: (Story) => {
    return (
      <FiresotreTestProvider>
        <Container size="4">
          <Story />
        </Container>
      </FiresotreTestProvider>
    )
  },
} satisfies Meta<typeof Summary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Expenditures")).toBeInTheDocument()
    expect(await canvas.findByText("￥999,999")).toBeInTheDocument()

    expect(await canvas.findByText("Income")).toBeInTheDocument()
    expect(await canvas.findByText("￥1,000,000")).toBeInTheDocument()
  },
}

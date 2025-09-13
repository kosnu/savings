import { Card } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, waitFor, within } from "storybook/test"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./Accordion"

const meta = {
  title: "Common/Misc/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <Card style={{ maxWidth: 320 }}>
        <Story />
      </Card>
    ),
  ],
} satisfies Meta<typeof Accordion>

export default meta

type Story = StoryObj<typeof Accordion>

export const Default: Story = {
  args: {
    type: "single",
    collapsible: true,
    children: (
      <>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it unstyled?</AccordionTrigger>
          <AccordionContent>
            Yes. It's unstyled by default, giving you freedom over the look and
            feel.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const firstButton = canvas.getByRole("button", {
      name: /Is it accessible?/i,
    })
    await userEvent.click(firstButton)

    expect(
      await canvas.findByText(
        /Yes. It adheres to the WAI-ARIA design pattern./i,
      ),
    ).toBeInTheDocument()
    expect(
      canvas.queryByText(
        /Yes. It's unstyled by default, giving you freedom over the look and feel./i,
      ),
    ).not.toBeInTheDocument()

    const secondButton = canvas.getByRole("button", {
      name: /Is it unstyled?/i,
    })
    await userEvent.click(secondButton)

    // Wait for the first content to be removed from the DOM
    await waitFor(() =>
      expect(
        canvas.queryByText(/Yes. It adheres to the WAI-ARIA design pattern./i),
      ).not.toBeInTheDocument(),
    )
    expect(
      await canvas.findByText(
        /Yes. It's unstyled by default, giving you freedom over the look and feel./i,
      ),
    ).toBeInTheDocument()
  },
}

export const Multiple: Story = {
  args: {
    type: "multiple",
    children: (
      <>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it unstyled?</AccordionTrigger>
          <AccordionContent>
            Yes. It's unstyled by default, giving you freedom over the look and
            feel.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const firstButton = canvas.getByRole("button", {
      name: /Is it accessible?/i,
    })
    await userEvent.click(firstButton)

    expect(
      await canvas.findByText(
        /Yes. It adheres to the WAI-ARIA design pattern./i,
      ),
    ).toBeInTheDocument()
    expect(
      canvas.queryByText(
        /Yes. It's unstyled by default, giving you freedom over the look and feel./i,
      ),
    ).not.toBeInTheDocument()

    const secondButton = canvas.getByRole("button", {
      name: /Is it unstyled?/i,
    })
    await userEvent.click(secondButton)

    expect(
      await canvas.findByText(
        /Yes. It adheres to the WAI-ARIA design pattern./i,
      ),
    ).toBeInTheDocument()
    expect(
      await canvas.findByText(
        /Yes. It's unstyled by default, giving you freedom over the look and feel./i,
      ),
    ).toBeInTheDocument()
  },
}

import { Card } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion"

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
          <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it unstyled?</AccordionTrigger>
          <AccordionContent>
            Yes. It's unstyled by default, giving you freedom over the look and feel.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
}

export const Multiple: Story = {
  args: {
    type: "multiple",
    children: (
      <>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it unstyled?</AccordionTrigger>
          <AccordionContent>
            Yes. It's unstyled by default, giving you freedom over the look and feel.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
}

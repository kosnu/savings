import { CalendarIcon } from "@radix-ui/react-icons"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { userEvent, within } from "storybook/test"
import { SidebarTreeButton } from "./SidebarTreeButton"

const sampleTreeObject = {
  id: "title",
  icon: <CalendarIcon />,
  label: "Payments",
  children: [
    {
      id: "2025",
      label: "2025年",
      children: [
        {
          id: "01",
          label: "1月",
          href: "/payments?year=2025&month=01",
        },
        {
          id: "02",
          label: "2月",
          href: "/payments?year=2025&month=02",
        },
      ],
    },
    {
      id: "2024",
      label: "2024年",
      children: [
        {
          id: "01",
          label: "1月",
          href: "/payments?year=2024&month=01",
        },
      ],
    },
    {
      id: "2023",
      label: "2023年",
      children: [],
    },
  ],
}

const meta = {
  title: "Common/Buttons/SidebarTreeButton",
  component: SidebarTreeButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/"]}>
        <div style={{ width: "300px" }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SidebarTreeButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    treeObject: sampleTreeObject,
  },
}

export const OpenFirstTree: Story = {
  args: {
    treeObject: sampleTreeObject,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = await canvas.findByRole("button", {
      name: sampleTreeObject.label,
    })
    await userEvent.click(button)
  },
}

export const OpenSecondTree: Story = {
  args: {
    treeObject: sampleTreeObject,
  },
  play: async (ctx) => {
    await OpenFirstTree.play?.(ctx)
    const canvas = within(ctx.canvasElement)

    const button = await canvas.findByRole("button", {
      name: sampleTreeObject.children[0].label,
    })
    await userEvent.click(button)

    for (const child of sampleTreeObject.children[0].children) {
      await canvas.findByRole("button", {
        name: child.label,
      })
    }
  },
}

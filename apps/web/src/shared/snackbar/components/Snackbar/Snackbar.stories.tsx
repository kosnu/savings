import { Button } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useCallback, useState } from "react"
import { expect, fn, userEvent, within } from "storybook/test"
import { Snackbar } from "./Snackbar"

const meta = {
  title: "Shared/Snackbar",
  component: Snackbar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    open: true,
    onClose: fn(),
  },
  render: ({ onClose, ...args }) => {
    const [open, setOpen] = useState(false)

    const handleOpen = useCallback(() => {
      setOpen(true)
    }, [])

    const handleClose = useCallback(() => {
      setOpen(false)
      onClose()
    }, [onClose])

    return (
      <>
        <Button onClick={handleOpen}>Open snackbar</Button>
        <Snackbar {...args} open={open} onClose={handleClose} />
      </>
    )
  },
} satisfies Meta<typeof Snackbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    message: "This is a message",
    type: "info",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole("button", { name: "Open snackbar" })
    await userEvent.click(button)

    const body = within(canvasElement.ownerDocument.body)
    const text = await body.findByText("This is a message")
    expect(text).toBeInTheDocument()
  },
}

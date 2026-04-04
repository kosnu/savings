import { Button } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useCallback, useState } from "react"
import { fn } from "storybook/test"

import { Snackbar } from "./Snackbar"

const meta = {
  title: "Common/Feadbacks/Snackbar",
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
}

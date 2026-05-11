import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { ErrorPage } from "./ErrorPage"

const meta = {
  title: "Pages/ErrorPage",
  component: ErrorPage,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs", "browser-test"],
  decorators: [createStoryRouter("/")],
  args: {
    error: new Error("Storybook root error"),
    info: {
      componentStack: "",
    },
    reset: () => {},
  },
} satisfies Meta<typeof ErrorPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: "Reload page" })).toBeInTheDocument()
    expect(canvas.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/")
    expect(canvas.queryByText("Storybook root error")).not.toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from "@storybook/react"
import { FirestoreProvider } from "../../../utils/firebase"
import { TopPage } from "./TopPage"

const meta = {
  title: "Pages/TopPage",
  component: TopPage,
  parameters: {},
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <FirestoreProvider>
        <Story />
      </FirestoreProvider>
    ),
  ],
  argTypes: {},
  args: {},
} satisfies Meta<typeof TopPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

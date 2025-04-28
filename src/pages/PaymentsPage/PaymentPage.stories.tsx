import type { Meta, StoryObj } from "@storybook/react"
import { FirestoreProvider } from "../../utils/firebase"
import { PaymentsPage } from "./PaymentsPage"

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
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
} satisfies Meta<typeof PaymentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

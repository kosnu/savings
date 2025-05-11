import type { Meta, StoryObj } from "@storybook/react"
import { FiresotreTestProvider } from "../../../utils/firebase/FirebaseProvider"
import { firebaseTestConfig } from "../../../utils/firebase/firebase"
import { PaymentsPage } from "./PaymentsPage"

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
  parameters: {},
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <FiresotreTestProvider options={firebaseTestConfig}>
        <Story />
      </FiresotreTestProvider>
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

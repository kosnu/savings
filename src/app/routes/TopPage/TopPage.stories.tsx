import type { Meta, StoryObj } from "@storybook/react"
import { FiresotreTestProvider } from "../../../utils/firebase/FirebaseTestProvider"
import { TopPage } from "./TopPage"

const meta = {
  title: "Pages/TopPage",
  component: TopPage,
  parameters: {},
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <FiresotreTestProvider>
        <Story />
      </FiresotreTestProvider>
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

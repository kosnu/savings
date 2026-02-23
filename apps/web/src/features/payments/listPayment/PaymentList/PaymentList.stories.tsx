import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, fn, within } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../../providers/firebase"
import { PaymentList } from "./PaymentList"

const meta = {
  title: "Features/ListPayment/PaymentList",
  component: PaymentList,
  parameters: {},
  tags: ["autodocs"],
  beforeEach: async () => {
    initFirebase(firebaseConfig)
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/payments?year=2025&month=06"]}>
        <FirestoreProvider config={firebaseConfig}>
          <Story />
        </FirestoreProvider>
      </MemoryRouter>
    ),
  ],
  argTypes: {},
  args: {
    onDeleteSuccess: fn(),
  },
} satisfies Meta<typeof PaymentList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByLabelText("payment-list")).toBeInTheDocument()
    expect(await canvas.findAllByLabelText("payment-item")).toHaveLength(4)
  },
}

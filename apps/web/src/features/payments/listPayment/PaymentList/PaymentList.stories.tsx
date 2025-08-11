import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, fn, within } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../../providers/firebase"
import { payments } from "../../../../test/data/payments"
import { user } from "../../../../test/data/users"
import { insertPayments } from "../../../../test/utils/insertPayments"
import { insertUser } from "../../../../test/utils/insertUser"
import { signInMockUser } from "../../../../test/utils/signInByMockUser"
import { PaymentList } from "./PaymentList"

const meta = {
  title: "Features/ListPayment/PaymentList",
  component: PaymentList,
  parameters: {},
  tags: ["autodocs"],
  beforeEach: async () => {
    // FIXME: FiresotreTestProvider と処理が重複している
    //        上記を解決したいけど、テストデータ挿入処理前にFirebaseを初期化しないといけないので、
    //        FiresotreTestProvider の描画タイミングだと間に合わない
    const { firestore, auth } = initFirebase(firebaseConfig)

    await signInMockUser(auth, user)
    await insertUser(firestore, user)
    await insertPayments(auth, firestore, payments)
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/payments?year=2025&month=04"]}>
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
    expect(await canvas.findAllByLabelText("payment-item")).toHaveLength(1)
  },
}

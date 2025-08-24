import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, fn } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/default"
import { FirestoreProvider, initFirebase } from "../../../../providers/firebase"
import { foodCat } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { user } from "../../../../test/data/users"
import { insertPayments } from "../../../../test/utils/insertPayments"
import { insertUser } from "../../../../test/utils/insertUser"
import { signInMockUser } from "../../../../test/utils/signInByMockUser"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../../utils/toCurrency"
import { PaymentItem } from "./PaymentItem"

const meta = {
  title: "Features/ListPayment/PaymentItem",
  component: PaymentItem,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onDeleteSuccess: fn(),
  },
  beforeEach: async () => {
    // FIXME: FirestoreProvider と処理が重複している
    //        上記を解決したいけど、テストデータ挿入処理前にFirebaseを初期化しないといけないので、
    //        FirestoreProvider の描画タイミングだと間に合わない
    const { firestore, auth } = initFirebase(firebaseConfig)

    await signInMockUser(auth, user)
    await insertUser(firestore, user)
    await insertPayments(auth, firestore, [payments[0]])
  },
  decorators: [
    (Story) => {
      return (
        <FirestoreProvider config={firebaseConfig}>
          <Story />
        </FirestoreProvider>
      )
    },
  ],
} satisfies Meta<typeof PaymentItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    payment: payments[0],
    category: foodCat,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const title = payments[0].note
    const date = formatDateToLocaleString(payments[0].date)
    const price = toCurrency(payments[0].amount)
    expect(canvas.getByText(title)).toBeInTheDocument()
    expect(canvas.getByText(date)).toBeInTheDocument()
    expect(canvas.getByText(price)).toBeInTheDocument()
    expect(
      canvas.getByRole("button", { name: "Payment actions" }),
    ).toBeInTheDocument()
  },
}

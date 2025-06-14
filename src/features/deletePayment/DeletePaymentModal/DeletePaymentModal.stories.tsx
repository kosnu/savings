import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, userEvent } from "storybook/test"
import { longPayment, payments } from "../../../test/data/payments"
import { user } from "../../../test/data/users"
import { insertPayments } from "../../../test/utils/insertPayments"
import { insertUser } from "../../../test/utils/insertUser"
import { signInMockUser } from "../../../test/utils/signInByMockUser"
import {
  FiresotreTestProvider,
  initEmulatedFirebase,
} from "../../../utils/firebase/FirebaseTestProvider"
import { DeletePaymentModal } from "./DeletePaymentModal"

const meta = {
  title: "Features/DeletePayment/DeletePaymentModal",
  component: DeletePaymentModal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {},
  beforeEach: async () => {
    // FIXME: FiresotreTestProvider と処理が重複している
    //        上記を解決したいけど、テストデータ挿入処理前にFirebaseを初期化しないといけないので、
    //        FiresotreTestProvider の描画タイミングだと間に合わない
    const { firestore, auth } = initEmulatedFirebase()

    await signInMockUser(auth, user)
    await insertUser(firestore, user)
    await insertPayments(auth, firestore, payments)
  },
  decorators: [
    (Story) => {
      return (
        <FiresotreTestProvider>
          <Story />
        </FiresotreTestProvider>
      )
    },
  ],
} satisfies Meta<typeof DeletePaymentModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    payment: payments[0],
  },
}

export const LongInfo: Story = {
  args: {
    payment: longPayment,
  },
}

export const ClickDeleteButton: Story = {
  args: {
    payment: payments[0],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const openButton = canvas.getByRole("button", { name: /delete payment/i })
    await userEvent.click(openButton)

    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog")
    expect(dialog).toBeInTheDocument()

    const title = within(dialog).getByRole("heading", {
      name: /delete this payment\?/i,
    })
    expect(title).toBeInTheDocument()

    const closeButton = within(dialog).getByRole("button", { name: /cancel/i })
    await userEvent.click(closeButton)

    const deleteButton = within(dialog).getByRole("button", { name: /delete/i })
    await userEvent.click(deleteButton)
  },
}

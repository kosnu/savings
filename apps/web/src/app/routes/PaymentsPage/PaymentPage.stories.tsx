import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, waitFor, within } from "storybook/test"
import { firebaseConfig } from "../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../providers/firebase"
import { payments } from "../../../test/data/payments"
import { user } from "../../../test/data/users"
import { insertPayments } from "../../../test/utils/insertPayments"
import { insertUser } from "../../../test/utils/insertUser"
import { signInMockUser } from "../../../test/utils/signInByMockUser"
import { PaymentsPage } from "./PaymentsPage"

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
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
    (Story) => {
      return (
        <MemoryRouter initialEntries={["/payments"]}>
          <FirestoreProvider config={firebaseConfig}>
            <Story />
          </FirestoreProvider>
        </MemoryRouter>
      )
    },
  ],
  argTypes: {},
  args: {},
} satisfies Meta<typeof PaymentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    canvas.getByRole("button", { name: /create payment/i })

    expect(await canvas.findAllByText("コンビニ")).toHaveLength(3)
    expect(await canvas.findByText("スーパー")).toBeInTheDocument()
    expect(await canvas.findByText("2025/06/02")).toBeInTheDocument()
    expect(await canvas.findAllByText("￥4,000")).toHaveLength(2)
  },
}

export const CreateAndDelete: Story = {
  args: {},
  tags: ["skip"],
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const createButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(createButton)

    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    expect(dialog).toBeInTheDocument()

    const categorySelect = within(dialog).getByRole("combobox", {
      name: /category/i,
    })
    await userEvent.click(categorySelect)
    const listbox = await body.findByRole("listbox")
    const foodOption = await within(listbox).findByRole("option", {
      name: /food/i,
    })
    await userEvent.click(foodOption)

    const timestamp = Date.now().toString()
    const note = `Test_${timestamp}`

    const noteInput = within(dialog).getByRole("textbox", { name: /note/i })
    await userEvent.type(noteInput, note)

    const amountTextfield = within(dialog).getByRole("textbox", {
      name: /amount/i,
    })
    await userEvent.type(amountTextfield, "1080")

    await waitFor(() => {
      expect(noteInput).toHaveValue(note)
      expect(amountTextfield).toHaveValue("1080")
    })

    // FIXME: Submitからリストのリフレッシュまでが早すぎて、PaymentListの再描画が間に合わない
    const submitButton = within(dialog).getByRole("button", {
      name: /create/i,
    })
    await userEvent.click(submitButton)

    expect(await canvas.findByText(note)).toBeInTheDocument()

    // TODO: PaymentItemのアクションから削除を行う処理を実装する

    expect(canvas.queryByText(note)).not.toBeInTheDocument()
  },
}

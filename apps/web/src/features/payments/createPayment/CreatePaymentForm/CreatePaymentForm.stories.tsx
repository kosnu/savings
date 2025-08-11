import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, fn, userEvent, waitFor } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../../providers/firebase"
import { categories } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { user } from "../../../../test/data/users"
import { insertCategories } from "../../../../test/utils/insertCategories"
import { insertPayments } from "../../../../test/utils/insertPayments"
import { insertUser } from "../../../../test/utils/insertUser"
import { signInMockUser } from "../../../../test/utils/signInByMockUser"
import { ThemeProvider } from "../../../../utils/theme/ThemeProvider"
import { CreatePaymentForm } from "./CreatePaymentForm"

const meta = {
  title: "Features/CreatePayment/CreatePaymentForm",
  component: CreatePaymentForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onSuccess: fn(),
    onCancel: fn(),
  },
  beforeEach: async () => {
    // FIXME: FiresotreTestProvider と処理が重複している
    //        上記を解決したいけど、テストデータ挿入処理前にFirebaseを初期化しないといけないので、
    //        FiresotreTestProvider の描画タイミングだと間に合わない
    const { firestore, auth } = initFirebase(firebaseConfig)

    await signInMockUser(auth, user)
    const userId = auth.currentUser?.uid ?? user.id
    await insertUser(firestore, { ...user, id: userId })
    await insertCategories(auth, firestore, categories)
    await insertPayments(auth, firestore, payments)
  },
  decorators: (Story) => {
    return (
      <ThemeProvider>
        <FirestoreProvider config={firebaseConfig}>
          <Story />
        </FirestoreProvider>
      </ThemeProvider>
    )
  },
} satisfies Meta<typeof CreatePaymentForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Fiiled: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const datepicker = canvas.getByRole("button", { name: /date/i })
    await userEvent.click(datepicker)

    const body = canvasElement.ownerDocument.body
    {
      const todayButton = await within(body).findByRole("button", {
        name: /today/i,
      })
      await userEvent.click(todayButton)
    }
    {
      const select = await canvas.findByRole("combobox", { name: /category/i })
      await userEvent.click(select)

      const body = within(canvasElement.ownerDocument.body)
      const listbox = await body.findByRole("listbox")

      await waitFor(() => {
        // "loading" ラベルの要素が存在しないことを確認
        expect(
          within(listbox).queryByLabelText(/loading/),
        ).not.toBeInTheDocument()
      })

      const option = await within(listbox).findByRole("option", {
        name: /food/i,
      })
      await userEvent.click(option)
    }
    {
      const noteTextfield = canvas.getByRole("textbox", { name: /note/i })
      await userEvent.type(noteTextfield, "Test_FSf5qxLNxAC265uSTcNa")
    }
    {
      const amountTextfield = canvas.getByRole("spinbutton", {
        name: /amount/i,
      })
      await userEvent.type(amountTextfield, "1080")
    }
  },
}

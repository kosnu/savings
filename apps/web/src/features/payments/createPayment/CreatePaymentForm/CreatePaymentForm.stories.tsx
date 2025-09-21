import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { within } from "@testing-library/react"
import { expect, fn, userEvent, waitFor } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/test"
import { createQueryClient } from "../../../../lib/queryClient"
import { FirestoreProvider, initFirebase } from "../../../../providers/firebase"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { categories } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { user } from "../../../../test/data/users"
import { insertCategories } from "../../../../test/utils/insertCategories"
import { insertPayments } from "../../../../test/utils/insertPayments"
import { insertUser } from "../../../../test/utils/insertUser"
import { signInMockUser } from "../../../../test/utils/signInByMockUser"
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
    const queryClient = createQueryClient()

    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <FirestoreProvider config={firebaseConfig}>
            <Story />
          </FirestoreProvider>
        </QueryClientProvider>
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

    // NOTE: 今日の日付はデフォルトで選択されているので、あえてクリックしない
    // const body = canvasElement.ownerDocument.body
    // {
    //   const todayButton = await within(body).findByRole("button", {
    //     name: /today/i,
    //   })
    //   await userEvent.click(todayButton)
    // }
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
      const amountTextfield = canvas.getByRole("textbox", { name: /amount/i })
      await userEvent.type(amountTextfield, "1080")
    }
  },
}

export const Empty: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const submitButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(submitButton)

    expect(canvas.getByText("Category can not be empty")).toBeInTheDocument()
    expect(canvas.getByText("Note can not be empty")).toBeInTheDocument()
    expect(canvas.getByText("Amount can not be empty")).toBeInTheDocument()
  },
}

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
import { CreatePaymentModal } from "./CreatePaymentModal"

const meta = {
  title: "Features/CreatePayment/CreatePaymentModal",
  component: CreatePaymentModal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onSuccess: fn(),
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
} satisfies Meta<typeof CreatePaymentModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OpenModal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const openButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(openButton)

    const body = within(canvasElement.ownerDocument.body)
    expect(await body.findByRole("dialog")).toBeInTheDocument()
  },
}

export const ContinuousCreationEnabled: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    // Open the dialog
    const openButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(openButton)

    // Wait for dialog to appear
    const dialog = await body.findByRole("dialog")
    expect(dialog).toBeInTheDocument()

    // Enable continuous creation mode
    const checkbox = body.getByRole("checkbox", { name: /continue creating/i })
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    // Fill the form - select category
    const categorySelect = body.getByRole("combobox", { name: /category/i })
    await userEvent.click(categorySelect)

    const listbox = await body.findByRole("listbox")
    await waitFor(() => {
      expect(
        within(listbox).queryByLabelText(/loading/),
      ).not.toBeInTheDocument()
    })

    const categoryOption = await within(listbox).findByRole("option", {
      name: /food/i,
    })
    await userEvent.click(categoryOption)

    // Fill other fields
    const amountInput = body.getByLabelText(/amount/i)
    await userEvent.type(amountInput, "1000")

    const noteInput = body.getByLabelText(/note/i)
    await userEvent.type(noteInput, "Test payment")

    // Submit the form
    const submitButton = body.getByRole("button", {
      name: /create payment/i,
    })
    await userEvent.click(submitButton)

    // Wait for submission to complete and verify dialog remains open
    await waitFor(
      () => {
        expect(body.queryByRole("dialog")).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // Verify form was reset (amount should be empty)
    await waitFor(
      () => {
        const amountInputAfterSubmit = body.getByLabelText(/amount/i)
        expect(amountInputAfterSubmit).toHaveValue("")
      },
      { timeout: 1000 },
    )

    // Verify checkbox remains checked after form reset
    const checkboxAfterSubmit = body.getByRole("checkbox", {
      name: /continue creating/i,
    })
    expect(checkboxAfterSubmit).toBeChecked()

    // Verify onSuccess was called (dialog should stay open)
    expect(args.onSuccess).toHaveBeenCalled()
  },
}

export const ContinuousCreationDisabled: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    // Open the dialog
    const openButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(openButton)

    // Wait for dialog to appear
    const dialog = await body.findByRole("dialog")
    expect(dialog).toBeInTheDocument()

    // Verify checkbox is not checked by default
    const checkbox = body.getByRole("checkbox", { name: /continue creating/i })
    expect(checkbox).not.toBeChecked()

    // Fill the form - select category
    const categorySelect = body.getByRole("combobox", { name: /category/i })
    await userEvent.click(categorySelect)

    const listbox = await body.findByRole("listbox")
    await waitFor(() => {
      expect(
        within(listbox).queryByLabelText(/loading/),
      ).not.toBeInTheDocument()
    })

    const categoryOption = await within(listbox).findByRole("option", {
      name: /food/i,
    })
    await userEvent.click(categoryOption)

    // Fill other fields
    const amountInput = body.getByLabelText(/amount/i)
    await userEvent.type(amountInput, "2000")

    const noteInput = body.getByLabelText(/note/i)
    await userEvent.type(noteInput, "Test payment without continuous mode")

    // Submit the form
    const submitButton = body.getByRole("button", {
      name: /create payment/i,
    })
    await userEvent.click(submitButton)

    // Wait for submission to complete and verify onSuccess was called
    await waitFor(
      () => {
        expect(args.onSuccess).toHaveBeenCalled()
      },
      { timeout: 3000 },
    )
  },
}

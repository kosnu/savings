import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../../providers/firebase"
import { categories } from "../../../../test/data/categories"
import { user } from "../../../../test/data/users"
import { insertCategories } from "../../../../test/utils/insertCategories"
import { insertUser } from "../../../../test/utils/insertUser"
import { signInMockUser } from "../../../../test/utils/signInByMockUser"
import { CategorySelect } from "./CategorySelect"

const meta = {
  title: "Features/CreatePayment/CategorySelect",
  component: CategorySelect,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  beforeEach: async () => {
    // FIXME: FiresotreTestProvider と処理が重複している
    //        上記を解決したいけど、テストデータ挿入処理前にFirebaseを初期化しないといけないので、
    //        FiresotreTestProvider の描画タイミングだと間に合わない
    const { firestore, auth } = initFirebase(firebaseConfig)

    await signInMockUser(auth, user)
    const userId = auth.currentUser?.uid ?? user.id
    await insertUser(firestore, { ...user, id: userId })
    await insertCategories(auth, firestore, categories)
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
} satisfies Meta<typeof CategorySelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Filled: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const select = canvas.getByRole("combobox", { name: /category/i })
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
  },
}

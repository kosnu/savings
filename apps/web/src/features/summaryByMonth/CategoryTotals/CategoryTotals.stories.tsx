import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, within } from "storybook/test"
import { firebaseConfig } from "../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../providers/firebase"
import { categories } from "../../../test/data/categories"
import { payments } from "../../../test/data/payments"
import { user } from "../../../test/data/users"
import { insertCategories } from "../../../test/utils/insertCategories"
import { insertPayments } from "../../../test/utils/insertPayments"
import { insertUser } from "../../../test/utils/insertUser"
import { signInMockUser } from "../../../test/utils/signInByMockUser"
import { CategoryTotals } from "./CategoryTotals"

const meta = {
  title: "Features/SummaryByMonth/CategoryTotals",
  component: CategoryTotals,
  tags: ["autodocs"],
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
      <MemoryRouter initialEntries={["/payments?year=2025&month=04"]}>
        <FirestoreProvider config={firebaseConfig}>
          <Story />
        </FirestoreProvider>
      </MemoryRouter>
    )
  },
} satisfies Meta<typeof CategoryTotals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    chunkSize: 2,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // 指定したチャンク数分の DataList が表示されていること
    expect(
      await canvas.findByLabelText(/category totals chunk 0/i),
    ).toBeInTheDocument()
    expect(
      await canvas.findByLabelText(/category totals chunk 1/i),
    ).toBeInTheDocument()

    // カテゴリごとの合計金額が表示されていること
    for (const category of categories) {
      expect(await canvas.findByText(category.name)).toBeInTheDocument()
    }
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument()
    expect(await canvas.findAllByText("￥0")).toHaveLength(3)
  },
}

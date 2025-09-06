import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { expect } from "storybook/test"
import { firebaseConfig } from "../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../providers/firebase"
import { incomes } from "../../../test/data/incomes"
import { payments } from "../../../test/data/payments"
import { user } from "../../../test/data/users"
import { insertIncomes } from "../../../test/utils/insertIncomes"
import { insertPayments } from "../../../test/utils/insertPayments"
import { insertUser } from "../../../test/utils/insertUser"
import { signInMockUser } from "../../../test/utils/signInByMockUser"
import { Summary } from "./Summary"

const meta = {
  title: "Features/SummaryByMonth/Summary",
  component: Summary,
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
    await insertPayments(auth, firestore, payments)
    await insertIncomes(auth, firestore, incomes)
  },
  decorators: (Story) => {
    return (
      <MemoryRouter initialEntries={["/payments?year=2025&month=04"]}>
        <FirestoreProvider config={firebaseConfig}>
          <Container size="4">
            <Story />
          </Container>
        </FirestoreProvider>
      </MemoryRouter>
    )
  },
} satisfies Meta<typeof Summary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Expenditures")).toBeInTheDocument()
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument()
  },
}

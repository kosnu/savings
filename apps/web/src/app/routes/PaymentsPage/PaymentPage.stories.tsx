import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { expect, within } from "storybook/test"
import { payments } from "../../../test/data/payments"
import { user } from "../../../test/data/users"
import { insertPayments } from "../../../test/utils/insertPayments"
import { insertUser } from "../../../test/utils/insertUser"
import { signInMockUser } from "../../../test/utils/signInByMockUser"
import {
  FiresotreTestProvider,
  initEmulatedFirebase,
} from "../../../utils/firebase/FirebaseTestProvider"
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
    const { firestore, auth } = initEmulatedFirebase()

    await signInMockUser(auth, user)
    await insertUser(firestore, user)
    await insertPayments(auth, firestore, payments)
  },
  decorators: [
    (Story) => {
      return (
        <MemoryRouter initialEntries={["/payments"]}>
          <FiresotreTestProvider>
            <Story />
          </FiresotreTestProvider>
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
    expect(await canvas.findAllByText("4000")).toHaveLength(2)
  },
}

import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { expect } from "storybook/test"
import { payments } from "../../../test/data/payments"
import { user } from "../../../test/data/users"
import { insertPayments } from "../../../test/utils/insertPayments"
import { insertUser } from "../../../test/utils/insertUser"
import { signInMockUser } from "../../../test/utils/signInByMockUser"
import {
  FiresotreTestProvider,
  initEmulatedFirebase,
} from "../../../utils/firebase/FirebaseTestProvider"
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
    const { firestore, auth } = initEmulatedFirebase()

    await signInMockUser(auth, user)
    const userId = auth.currentUser?.uid ?? user.id
    await insertUser(firestore, { ...user, id: userId })
    await insertPayments(auth, firestore, payments)
  },
  decorators: (Story) => {
    return (
      <MemoryRouter initialEntries={["/payments?year=2025&month=04"]}>
        <FiresotreTestProvider>
          <Container size="4">
            <Story />
          </Container>
        </FiresotreTestProvider>
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

    expect(await canvas.findByText("Income")).toBeInTheDocument()
    expect(await canvas.findByText("￥1,000,000")).toBeInTheDocument()
  },
}

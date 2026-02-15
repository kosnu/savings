import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { expect, waitForElementToBeRemoved } from "storybook/test"
import { firebaseConfig } from "../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../providers/firebase"
import { categories } from "../../../test/data/categories"
import { payments } from "../../../test/data/payments"
import { user } from "../../../test/data/users"
import { insertCategories } from "../../../test/utils/insertCategories"
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
    await insertCategories(auth, firestore, categories)
    await insertPayments(auth, firestore, payments)
  },
  decorators: (Story) => {
    return (
      <MemoryRouter initialEntries={["/payments?year=2025&month=06"]}>
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
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    await waitForElementToBeRemoved(() => canvas.queryByTestId("skeleton"))

    expect(await canvas.findByText("Total spending")).toBeInTheDocument()
    expect(await canvas.findByText("￥5,000")).toBeInTheDocument()

    const accordionTrigger = canvas.getByRole("button", {
      name: /by category/i,
    })
    expect(accordionTrigger).toBeInTheDocument()
    await userEvent.click(accordionTrigger)

    for (const category of Object.values(categories)) {
      expect(await canvas.findByText(category.name)).toBeInTheDocument()
    }
    expect(await canvas.findByText("Unknown")).toBeInTheDocument()

    expect(await canvas.findByText("￥4,000")).toBeInTheDocument()
    expect(await canvas.findAllByText("￥0")).toHaveLength(2)
  },
}

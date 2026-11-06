import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { payments } from "../../../test/data/payments"
import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { PaymentsPage } from "./PaymentsPage"

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
  parameters: {
    mockingDate: new Date(2025, 5, 15),
    msw: {
      handlers: [
        ...createBookHandlers(),
        ...createPaymentHandlers({
          initialRows: payments.map(mapPaymentToRow),
        }),
        ...createCategoryHandlers(),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 25000 } },
        }),
      ],
    },
  },
  tags: ["browser-test"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof PaymentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await canvas.findByRole("button", { name: /create payment/i })

    await expect(canvas.getByRole("heading", { level: 1, name: "Payments" })).toBeInTheDocument()
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1)

    expect(await canvas.findAllByText("コンビニ")).toHaveLength(2)
    expect(await canvas.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(canvas.queryByText("スーパー")).not.toBeInTheDocument()
    const paymentList = await canvas.findByLabelText("payment-list")
    expect(await within(paymentList).findByText("Jun 2, 2025")).toBeInTheDocument()
    expect(await within(paymentList).findByText("Jun 3, 2025")).toBeInTheDocument()
    expect(await within(paymentList).findByText("¥1,000")).toBeInTheDocument()
    expect(await within(paymentList).findByText("¥4,000")).toBeInTheDocument()
    expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument()
  },
}

export const OpenDetails: Story = {
  args: {},
  decorators: [createStoryRouter("/payments/details/2?year=2025&month=6", paymentsRouteBuilder)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await canvas.findByText("Jun 3, 2025")
    const paymentList = await canvas.findByLabelText("payment-list")
    expect(await within(paymentList).findByText("Daily Necessities")).toBeInTheDocument()

    const detailDialog = await body.findByRole("dialog", {
      name: /payment details/i,
    })
    expect(await within(detailDialog).findByText("Daily Necessities")).not.toHaveClass("rt-Badge")
    expect(await within(detailDialog).findAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(await within(detailDialog).findByText("Category")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("Jun 3, 2025")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("Daily Necessities")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("¥4,000")).toBeInTheDocument()
    expect(await within(detailDialog).findByRole("button", { name: /delete/i })).toBeInTheDocument()
  },
}

function searchFormStory(mobile: boolean): Story {
  return {
    decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
    parameters: {
      viewport: {
        options: {
          mobile: { name: "Mobile", styles: { width: "320px", height: "568px" } },
          desktop: { name: "Desktop", styles: { width: "1280px", height: "900px" } },
        },
      },
    },
    globals: { viewport: { value: mobile ? "mobile" : "desktop" } },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement)
      const body = within(canvasElement.ownerDocument.body)
      const search = await canvas.findByLabelText("Search filters")
      const filters = within(search)
      const year = filters.getByRole("combobox", { name: "Year" })
      const month = filters.getByRole("combobox", { name: "Month" })
      const category = filters.getByRole("combobox", { name: "Category filter" })

      await expect(year).toHaveTextContent("2025")
      await expect(month).toHaveTextContent("June")
      await expect(category).toHaveTextContent("All categories")
      for (const control of [year, month, category]) {
        const bounds = control.getBoundingClientRect()
        expect(bounds.left).toBeGreaterThanOrEqual(0)
        expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)
      }
      const monthBounds = month.getBoundingClientRect()
      const categoryBounds = category.getBoundingClientRect()
      if (mobile) {
        expect(categoryBounds.top).toBeGreaterThanOrEqual(monthBounds.bottom)
      } else {
        expect(categoryBounds.top).toBeCloseTo(monthBounds.top, 0)
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

      // 選択せず閉じても条件を保持し、再び選択できることを利用箇所で確認する。
      await userEvent.click(month)
      await body.findByRole("listbox")
      await userEvent.keyboard("{Escape}")
      await waitFor(async () => {
        await expect(body.queryByRole("listbox")).not.toBeInTheDocument()
      })
      await expect(month).toHaveTextContent("June")
      await expect(month).toHaveFocus()

      await userEvent.click(month)
      await userEvent.click(await body.findByRole("option", { name: "April" }))
      await expect(await canvas.findByRole("button", { name: /スーパー/ })).toBeInTheDocument()
      await userEvent.click(category)
      await userEvent.click(await body.findByRole("option", { name: "Food" }))
      await userEvent.click(year)
      await userEvent.click(await body.findByRole("option", { name: "2024" }))
      await expect(await canvas.findByText("No payments found.")).toBeInTheDocument()
      await expect(month).toHaveTextContent("April")
      await expect(category).toHaveTextContent("Food")

      await userEvent.click(canvas.getByRole("button", { name: "Clear filter" }))
      await expect(category).toHaveTextContent("All categories")
      await expect(year).toHaveTextContent("2024")
      await expect(month).toHaveTextContent("April")
      await userEvent.click(year)
      await userEvent.click(await body.findByRole("option", { name: "2025" }))
      await expect(await canvas.findByRole("button", { name: /スーパー/ })).toBeInTheDocument()
    },
  }
}

export const MobileSearch: Story = searchFormStory(true)
export const DesktopSearch: Story = searchFormStory(false)

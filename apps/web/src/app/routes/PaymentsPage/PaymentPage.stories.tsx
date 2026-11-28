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
import { AppLayout } from "../../AppLayout"
import { PaymentsPage } from "./PaymentsPage"

const paymentRows = payments.map(mapPaymentToRow)

function createPageHandlers(
  initialRows = paymentRows,
  update?: NonNullable<Parameters<typeof createPaymentHandlers>[0]>["update"],
) {
  return [
    ...createBookHandlers(),
    ...createPaymentHandlers({ initialRows, update }),
    ...createCategoryHandlers(),
    ...createMonthlyBudgetHandlers({
      get: { response: { ...monthlyBudgets[2], amount: 25000 } },
    }),
  ]
}

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
  parameters: {
    mockingDate: new Date(2025, 5, 15),
    msw: {
      handlers: createPageHandlers(),
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

    const createPayment = await canvas.findByRole("button", { name: /create payment/i })
    await expect(createPayment).toHaveClass("rt-variant-solid")
    await expect(createPayment.querySelector("svg")).toHaveAttribute("aria-hidden", "true")

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

export const StickyHeader: Story = {
  decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
  render: () => (
    <AppLayout>
      <PaymentsPage />
    </AppLayout>
  ),
  parameters: {
    msw: {
      handlers: createPageHandlers(
        Array.from({ length: 30 }, (_, index) => ({
          ...paymentRows[0],
          id: index + 1,
          note: `Payment #${index + 1}`,
        })),
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const header = await canvas.findByRole("banner")
    const payment = await canvas.findByRole("button", { name: /Payment #25\b/ })
    expect(
      within(header).queryByRole("button", { name: /create payment/i }),
    ).not.toBeInTheDocument()

    window.scrollTo(0, 300)
    await waitFor(() => {
      expect(window.scrollY).toBeGreaterThan(0)
      expect(header.getBoundingClientRect().top).toBeCloseTo(0)
    })

    await userEvent.click(payment)
    const dialog = await body.findByRole("dialog", { name: /payment details/i })
    await userEvent.click(within(dialog).getByRole("button", { name: /close payment details/i }))
    await waitFor(() => {
      expect(body.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
    })
    expect(window.scrollY).toBeGreaterThan(0)
    expect(header.getBoundingClientRect().top).toBeCloseTo(0)
    const menu = within(header).getByRole("button", {
      name: /menu button|hide sidebar|show sidebar/i,
    })
    const wasExpanded = menu.getAttribute("aria-expanded") === "true"
    await userEvent.click(menu)
    expect(menu).toHaveAttribute("aria-expanded", String(!wasExpanded))
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
      await expect(filters.queryByRole("heading")).not.toBeInTheDocument()
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

function paymentDetailsEditingStory(width: number, height: number): Story {
  const mobile = width < 768
  const longNote = "長いメモの表示確認ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const rows = paymentRows.map((row) => (row.id === 2 ? { ...row, note: longNote } : row))

  return {
    decorators: [createStoryRouter("/payments/details/2?year=2025&month=6", paymentsRouteBuilder)],
    beforeEach: ({ msw }) => {
      msw.use(...createPageHandlers(rows, { persistFor: { id: 2, book_id: 1 } }))
    },
    parameters: {
      viewport: {
        options: {
          paymentDetails: {
            name: "Payment details",
            styles: { width: `${width}px`, height: `${height}px` },
          },
        },
      },
    },
    globals: { viewport: { value: "paymentDetails" } },
    play: async ({ canvasElement }) => {
      expect(window.innerWidth).toBe(width)
      expect(window.innerHeight).toBe(height)
      const body = within(canvasElement.ownerDocument.body)
      const dialog = await body.findByRole("dialog", { name: /payment details/i })
      // ダイアログを開くときの拡大が終わってから寸法を測る。
      await Promise.all(dialog.getAnimations().map(async (animation) => animation.finished))
      const details = within(dialog)
      expect(dialog.getBoundingClientRect().width === width).toBe(mobile)
      const editNote = await details.findByRole("button", { name: /edit note/i })
      await waitFor(async () => {
        await expect(within(editNote).getByText(longNote)).toBeVisible()
        await expect(editNote.scrollWidth).toBe(editNote.clientWidth)
      })

      await userEvent.click(editNote)
      const note = details.getByRole("textbox", { name: "Note" })
      const save = details.getByRole("button", { name: /save note/i })
      expect(note).toHaveFocus()
      if (mobile) {
        const cancel = details.getByRole("button", { name: "Cancel" })
        expect(note.getBoundingClientRect().bottom).toBeLessThan(cancel.getBoundingClientRect().top)
        expect(cancel.getBoundingClientRect().right).toBeLessThan(save.getBoundingClientRect().left)
        await userEvent.clear(note)
        await userEvent.click(cancel)
        expect(details.getByText(longNote)).toBeVisible()
        await userEvent.click(details.getByRole("button", { name: /edit note/i }))
      } else {
        // 入力欄の外枠を基準に、保存ボタンとの間隔を測る。
        const fieldRoot = note.closest(".rt-TextFieldRoot")
        if (!fieldRoot) throw new Error("メモ入力欄の外枠が見つかりません")
        const inputBounds = fieldRoot.getBoundingClientRect()
        const saveBounds = save.getBoundingClientRect()
        expect(saveBounds.width).toBeCloseTo(32, 0)
        expect(saveBounds.height).toBeCloseTo(32, 0)
        expect(saveBounds.left - inputBounds.right).toBeCloseTo(8)
        expect(saveBounds.top + saveBounds.height / 2).toBeCloseTo(
          inputBounds.top + inputBounds.height / 2,
        )
        await userEvent.tab()
        expect(save).toHaveFocus()
        await userEvent.keyboard("{Escape}")
        expect(details.getByText(longNote)).toBeVisible()
        await userEvent.click(details.getByRole("button", { name: /edit note/i }))
      }
      const reopened = details.getByRole("textbox", { name: "Note" })
      expect(reopened).toHaveValue(longNote)
      const newSave = details.getByRole("button", { name: /save note/i })
      await userEvent.type(reopened, "追加")
      await userEvent.click(newSave)
      await expect(details.findByText(/Note must be/)).resolves.toBeVisible()
      expect(reopened).toHaveValue(`${longNote}追加`)
      await userEvent.clear(reopened)
      await userEvent.type(reopened, "Updated note")
      await expect(reopened).toHaveValue("Updated note")
      await userEvent.click(newSave)
      const updatedNote = await details.findByRole("button", { name: /edit note/i })
      expect(within(updatedNote).getByText("Updated note")).toBeVisible()

      if (width === 320) {
        await userEvent.click(details.getByRole("button", { name: /edit amount/i }))
        const amount = details.getByLabelText("Amount", { exact: false, selector: "input" })
        const saveAmount = details.getByRole("button", { name: /save amount/i })
        const cancelAmount = details.getByRole("button", { name: "Cancel" })
        await userEvent.clear(amount)
        await userEvent.type(amount, "-1")
        await userEvent.click(saveAmount)
        const error = await details.findByText("Amount must be a non-negative integer")
        expect(error).toBeVisible()
        expect(error.getBoundingClientRect().bottom).toBeLessThan(
          Math.min(
            cancelAmount.getBoundingClientRect().top,
            saveAmount.getBoundingClientRect().top,
          ),
        )
        await userEvent.clear(amount)
        await userEvent.type(amount, "4200")
        await userEvent.click(saveAmount)
        const updatedAmount = await details.findByRole("button", { name: /edit amount/i })
        expect(within(updatedAmount).getByText("¥4,200")).toBeVisible()
        expect(error).not.toBeInTheDocument()
      }
    },
  }
}

export const NarrowPaymentDetailsEditing = paymentDetailsEditingStory(320, 568)
export const MobilePaymentDetailsEditing = paymentDetailsEditingStory(390, 844)
export const DesktopPaymentDetailsEditing = paymentDetailsEditingStory(1280, 900)

function createPaymentCategoryResizeStory(resize: "visual" | "layout"): Story {
  const viewportWidth = resize === "visual" ? 411 : 390
  const initialViewportHeight = resize === "visual" ? 777 : 680
  return {
    decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
    parameters: {
      viewport: {
        options: {
          keyboardOpen: {
            name: "Keyboard open",
            styles: { width: `${viewportWidth}px`, height: `${initialViewportHeight}px` },
          },
        },
      },
    },
    globals: { viewport: { value: "keyboardOpen" } },
    play: async ({ canvasElement }) => {
      const viewport = window.visualViewport
      const frame = window.frameElement?.closest("iframe")
      const initialFrameHeight = frame?.style.height
      const resizeListener = new AbortController()
      const tap = async (target: HTMLElement) => {
        const { x, y, width, height } = target.getBoundingClientRect()
        await userEvent.pointer({
          keys: "[TouchA]",
          target,
          coords: { clientX: x + width / 2, clientY: y + height / 2 },
        })
      }
      const canvas = within(canvasElement)
      const body = within(canvasElement.ownerDocument.body)
      const waitForListboxToClose = async () =>
        waitFor(async () =>
          expect(body.queryByRole("listbox", { hidden: true })).not.toBeInTheDocument(),
        )
      const createPayment = await canvas.findByRole("button", { name: /create payment/i })

      await expect(window.innerWidth).toBe(viewportWidth)
      await expect(window.innerHeight).toBe(initialViewportHeight)
      await tap(createPayment)
      const dialog = await body.findByRole("dialog", { name: /create payment/i })
      const form = within(dialog)
      const amount = form.getByLabelText("Amount", { exact: false, selector: "input" })
      const category = form.getByRole("combobox", { name: "Category" })
      await waitFor(async () => expect(amount).toHaveFocus())
      await expect(amount).toHaveValue("")

      let visualHeight = 437
      try {
        if (resize === "visual") {
          if (!viewport) {
            throw new Error("visualViewport がありません")
          }
          Object.defineProperty(viewport, "height", { configurable: true, get: () => visualHeight })
        }
        await tap(category)
        await body.findByRole("option", { name: "Food" })
        await expect(amount).not.toHaveFocus()

        if (resize === "visual") {
          // Pixel で観測した順序で Visual Viewport と window の resize を送る。
          visualHeight = 778
          viewport?.dispatchEvent(new Event("resize"))
          window.dispatchEvent(new Event("resize"))
        } else {
          if (!frame) {
            throw new Error("プレビュー iframe がありません")
          }
          const resized = new Promise<void>((resolve) => {
            window.addEventListener("resize", () => resolve(), {
              once: true,
              signal: resizeListener.signal,
            })
          })
          frame.style.height = "844px"
          await resized
        }
        // resize による React の更新を描画に反映させてから開閉状態を確認する。
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
        await expect(window.innerHeight).toBe(resize === "visual" ? initialViewportHeight : 844)
        await expect(window.innerWidth).toBe(viewportWidth)
        await expect(category).toHaveAttribute("aria-expanded", "true")
        const food = await body.findByRole("option", { name: "Food" })
        const { x, y, width, height } = food.getBoundingClientRect()
        const coords = { clientX: x + width / 2, clientY: y + height / 2 }
        const hit = food.ownerDocument.elementFromPoint(coords.clientX, coords.clientY)
        expect(food.contains(hit)).toBe(true)
        await userEvent.pointer({ keys: "[TouchA]", target: food, coords })
        await expect(category).toHaveTextContent("Food")
        await waitForListboxToClose()
        await expect(amount).toHaveValue("")

        if (resize === "layout") return

        await userEvent.click(category)
        await body.findByRole("listbox")
        await userEvent.keyboard("{Escape}")
        await waitForListboxToClose()
        await waitFor(async () => expect(category).toHaveFocus())
        await expect(category).toHaveTextContent("Food")

        await userEvent.click(category)
        await body.findByRole("listbox")
        await userEvent.click(canvasElement.ownerDocument.documentElement)
        await waitForListboxToClose()
        await waitFor(async () => expect(category).toHaveFocus())
        await expect(category).toHaveTextContent("Food")

        await userEvent.click(category)
        await userEvent.click(await body.findByRole("option", { name: "Daily Necessities" }))
        await expect(category).toHaveTextContent("Daily Necessities")
        await waitForListboxToClose()

        await tap(category)
        await tap(await body.findByRole("option", { name: "None" }))
        await expect(category).toHaveTextContent("None")
      } finally {
        resizeListener.abort()
        if (resize === "visual" && viewport) {
          Reflect.deleteProperty(viewport, "height")
        }
        if (resize === "layout" && frame && initialFrameHeight !== undefined) {
          frame.style.height = initialFrameHeight
        }
      }
    },
  }
}

export const CreatePaymentCategoryAfterKeyboardCloses = createPaymentCategoryResizeStory("visual")
export const CreatePaymentCategoryAfterLayoutHeightIncreases =
  createPaymentCategoryResizeStory("layout")

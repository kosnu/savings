import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { CreatePaymentForm } from "./CreatePaymentForm"

const { mockCreatePayment } = vi.hoisted(() => ({
  mockCreatePayment: vi.fn(),
}))

vi.mock("../useCreatePayment", () => ({
  useCreatePayment: () => ({
    createPayment: mockCreatePayment,
    isPending: false,
  }),
}))

vi.mock("../CategoryField", () => ({
  CategoryField: ({
    value,
    onChange,
    messages,
  }: {
    value?: string
    onChange?: (category: string) => void
    messages?: string[]
  }) => (
    <div>
      <label htmlFor="category">Category</label>
      <input
        id="category"
        aria-label="Category"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {messages?.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  ),
}))

vi.mock("../NoteField", () => ({
  NoteField: ({
    value,
    onChange,
    messages,
  }: {
    value?: string
    onChange?: (note: string) => void
    messages?: string[]
  }) => (
    <div>
      <label htmlFor="note">Note</label>
      <input
        id="note"
        aria-label="Note"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {messages?.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  ),
}))

vi.mock("../AmountField/AmountField", () => ({
  AmountField: ({
    value,
    onChange,
    messages,
    autoFocus,
  }: {
    value?: number
    onChange?: (amount: number | undefined) => void
    messages?: string[]
    autoFocus?: boolean
  }) => (
    <div>
      <label htmlFor="amount">Amount</label>
      <input
        id="amount"
        aria-label="Amount"
        value={value?.toString() ?? ""}
        // biome-ignore lint/a11y/noAutofocus: This is a test mock
        autoFocus={autoFocus}
        onChange={(e) => {
          const inputValue = e.target.value
          if (inputValue === "") {
            onChange?.(undefined)
            return
          }
          const amount = Number(inputValue)
          if (!Number.isNaN(amount)) {
            onChange?.(amount)
          }
        }}
      />
      {messages?.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  ),
}))

vi.mock("../PaymentDateField", () => ({
  PaymentDateField: ({
    value,
    messages,
  }: {
    value?: Date
    messages?: string[]
  }) => (
    <div>
      <label htmlFor="date">Date</label>
      <input
        id="date"
        aria-label="Date"
        value={value ? value.toISOString() : ""}
        readOnly
      />
      {messages?.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  ),
}))

describe("CreatePaymentForm", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mockCreatePayment.mockReset()
    mockCreatePayment.mockResolvedValue(undefined)
  })

  test("should autofocus on the amount field when rendered", () => {
    render(<CreatePaymentForm onCancel={() => {}} />)

    const amountField = screen.getByRole("textbox", { name: /amount/i })
    expect(document.activeElement).toBe(amountField)
  })

  test("should show amount required message and not call createPayment when amount is empty", async () => {
    const user = userEvent.setup()

    render(<CreatePaymentForm onCancel={() => {}} />)

    await user.type(screen.getByRole("textbox", { name: /category/i }), "cat-1")
    await user.type(screen.getByRole("textbox", { name: /note/i }), "lunch")

    await user.click(screen.getByRole("button", { name: /create/i }))

    expect(await screen.findByText("Amount can not be empty")).toBeTruthy()
    expect(mockCreatePayment).not.toHaveBeenCalled()
  })

  test("should call createPayment with mapped payload when form is valid", async () => {
    const user = userEvent.setup()

    render(<CreatePaymentForm onCancel={() => {}} />)

    await user.type(screen.getByRole("textbox", { name: /category/i }), "cat-1")
    await user.type(screen.getByRole("textbox", { name: /note/i }), "dinner")
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "1080")

    await user.click(screen.getByRole("button", { name: /create/i }))

    await waitFor(() => {
      expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    })

    const payload = mockCreatePayment.mock.calls[0][0]
    expect(payload).toEqual(
      expect.objectContaining({
        categoryId: "cat-1",
        note: "dinner",
        amount: 1080,
      }),
    )
    expect(payload.date).toBeInstanceOf(Date)
  })
})

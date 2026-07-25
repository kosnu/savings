import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { toDateOnlyString } from "../../../../domain/date"
import { createBookHandlers } from "../../../../test/msw/handlers/books"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../../../test/test-utils"
import type { PaymentRow } from "../../../../types/payment"
import { paymentQueryKeys } from "../../queryKeys"
import * as stories from "./FrequentPaymentSuggestions.stories"

const { Default, Disabled, Empty, Error: ErrorStory, Loading } = composeStories(stories)

function createPaymentRow(id: number, note = "Lunch"): PaymentRow {
  const now = new Date()

  return {
    id,
    note,
    amount: 1200,
    date: toDateOnlyString(now),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    book_id: 1,
    category_id: 10,
  }
}

const candidateRows = [createPaymentRow(1), createPaymentRow(2), createPaymentRow(3)]

function toFrequentPaymentResponseRows(rows: PaymentRow[]) {
  return rows.map((row) => ({
    ...row,
    category:
      row.category_id === null
        ? null
        : {
            id: row.category_id,
            book_id: row.book_id,
            name: "Food",
          },
  }))
}

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("FrequentPaymentSuggestions", () => {
  beforeEach(() => {
    server.resetHandlers(
      ...createBookHandlers(),
      ...createPaymentHandlers({ get: { response: candidateRows } }),
    )
  })

  test("候補を主情報と補助情報に分けたCardとして表示し、clickで候補を通知する", async () => {
    const onSelect = vi.fn()
    const { user } = await renderStory(<Default onSelect={onSelect} />)

    const candidate = await screen.findByRole("button", {
      name: /use frequent payment: note lunch, amount ¥1,200, category food/i,
    })
    expect(
      screen.getByRole("group", {
        name: "Frequent payments",
      }),
    ).toContainElement(candidate)
    expect(within(candidate).getByText("Lunch")).toBeInTheDocument()
    expect(within(candidate).getByText("¥1,200")).toBeInTheDocument()
    expect(within(candidate).getByText("Food")).toBeInTheDocument()
    expect(within(candidate).queryByText("Note")).not.toBeInTheDocument()
    expect(within(candidate).queryByText("Amount")).not.toBeInTheDocument()
    expect(within(candidate).queryByText("Category")).not.toBeInTheDocument()

    await user.click(candidate)

    expect(onSelect).toHaveBeenCalledWith({
      note: "Lunch",
      amount: 1200,
      categoryId: 10,
      categoryName: "Food",
      count: 3,
    })
  })

  test("keyboardで候補を選択できる", async () => {
    const onSelect = vi.fn()
    const { user } = await renderStory(<Default onSelect={onSelect} />)
    const candidate = await screen.findByRole("button", {
      name: /use frequent payment: note lunch, amount ¥1,200, category food/i,
    })

    await user.tab()
    expect(candidate).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  test("同じメモの別候補を金額とカテゴリで選択前に区別できる", async () => {
    const sameNoteRows = [
      createPaymentRow(1),
      createPaymentRow(2),
      createPaymentRow(3),
      { ...createPaymentRow(4), amount: 1500, category_id: null },
      { ...createPaymentRow(5), amount: 1500, category_id: null },
      { ...createPaymentRow(6), amount: 1500, category_id: null },
    ]
    server.resetHandlers(
      ...createBookHandlers(),
      ...createPaymentHandlers({ get: { response: sameNoteRows } }),
    )

    await renderStory(<Default />)

    const foodCandidate = await screen.findByRole("button", {
      name: /use frequent payment: note lunch, amount ¥1,200, category food/i,
    })
    const categorylessCandidate = await screen.findByRole("button", {
      name: /use frequent payment: note lunch, amount ¥1,500, category none/i,
    })

    expect(within(foodCandidate).getByText("¥1,200")).toBeInTheDocument()
    expect(within(foodCandidate).getByText("Food")).toBeInTheDocument()
    expect(within(categorylessCandidate).getByText("¥1,500")).toBeInTheDocument()
    expect(within(categorylessCandidate).getByText("None")).toBeInTheDocument()
  })

  test("候補が0件の場合は関連UIを表示しない", async () => {
    let requestCount = 0
    server.resetHandlers(
      ...createBookHandlers(),
      http.get("*/rest/v1/payments*", () => {
        requestCount += 1
        return HttpResponse.json([])
      }),
    )

    await renderStory(<Empty />)

    await waitFor(() => {
      expect(requestCount).toBe(1)
    })
    expect(screen.queryByText("Frequent payments")).not.toBeInTheDocument()
  })

  test("取得中のStoryでは関連UIを表示しない", async () => {
    await renderStory(<Loading />)

    expect(screen.queryByText("Frequent payments")).not.toBeInTheDocument()
  })

  test("取得失敗時は関連UIを表示しない", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    let requestCount = 0
    server.resetHandlers(
      ...createBookHandlers(),
      http.get("*/rest/v1/payments*", () => {
        requestCount += 1
        return HttpResponse.json({ message: "Failed to fetch payments." }, { status: 500 })
      }),
    )

    await renderStory(<ErrorStory />)

    await waitFor(
      () => {
        expect(requestCount).toBe(1)
      },
      { timeout: 2000 },
    )
    await waitFor(() => {
      expect(screen.queryByText("Frequent payments")).not.toBeInTheDocument()
    })
    consoleError.mockRestore()
  })

  test("取得失敗後のrefetchが成功すると同じ表示境界で候補が復帰する", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const queryClient = createTestQueryClient()
    let requestCount = 0
    server.resetHandlers(
      ...createBookHandlers(),
      http.get("*/rest/v1/payments*", () => {
        requestCount += 1
        if (requestCount === 1) {
          return HttpResponse.json({ message: "Failed to fetch payments." }, { status: 500 })
        }
        return HttpResponse.json(toFrequentPaymentResponseRows(candidateRows))
      }),
    )

    await act(async () => {
      render(<Default />, { queryClient })
    })

    await waitFor(() => {
      expect(requestCount).toBe(1)
    })
    expect(screen.queryByText("Frequent payments")).not.toBeInTheDocument()

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: paymentQueryKeys.all })
    })

    expect(
      await screen.findByRole("button", {
        name: /use frequent payment: note lunch, amount ¥1,200, category food/i,
      }),
    ).toBeInTheDocument()
    consoleError.mockRestore()
  })

  test("disabled時は候補を選択できない", async () => {
    const onSelect = vi.fn()
    const { user } = await renderStory(<Disabled onSelect={onSelect} />)
    const candidate = await screen.findByRole("button", {
      name: /use frequent payment: note lunch, amount ¥1,200, category food/i,
    })

    expect(candidate).toBeDisabled()
    await user.click(candidate)

    expect(onSelect).not.toHaveBeenCalled()
  })
})

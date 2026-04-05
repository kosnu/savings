import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./PaymentDateField.stories"

const { Default, HasError } = composeStories(stories)

describe("CreatePayment PaymentDateField", () => {
  test("Default story ではラベル、メッセージ、入力欄を表示する", () => {
    render(<Default />)

    expect(screen.getByText("Date")).toBeInTheDocument()
    expect(screen.getByText("日付を選択してください")).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("HasError story では複数のエラーメッセージを表示する", () => {
    render(<HasError />)

    expect(screen.getByText("Date")).toBeInTheDocument()
    const message = screen.getByText((_, element) => {
      return element?.textContent === "日付が未選択です1年以上前の日付は選択できません"
    })
    expect(message).toHaveTextContent("日付が未選択です")
    expect(message).toHaveTextContent("1年以上前の日付は選択できません")
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })
})

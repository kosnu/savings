import { composeStories } from "@storybook/react-vite"
import { afterEach, describe, expect, test } from "vite-plus/test"

import { i18next } from "../../../i18n"
import { render, screen } from "../../../test/test-utils"
import * as stories from "./TopPage.stories"

const { Default } = composeStories(stories)

describe("TopPage", () => {
  afterEach(async () => {
    await i18next.changeLanguage("en")
  })

  test("利用開始のリンクからGoogle認証の画面へ進める", async () => {
    const { user } = render(<Default />)

    await user.click(
      (await screen.findAllByRole("link", { name: "Get started with My Savings" }))[0],
    )

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign in to My Savings" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
  })

  test.each([
    {
      language: "en",
      purpose: /My Savings is a budgeting app/,
      sample: "An example month with sample amounts",
      remaining: "¥32,000 left",
      start: "Get started with My Savings",
    },
    {
      language: "ja",
      purpose: /My Savingsは、予算と日々の支出を見比べられる家計簿です/,
      sample: "ある月の利用例（金額はサンプルです）",
      remaining: "残り ¥32,000",
      start: "My Savingsをはじめる",
    },
  ])(
    "$languageで用途と実データではない予算の利用例を伝える",
    async ({ language, purpose, sample, remaining, start }) => {
      await i18next.changeLanguage(language)
      render(<Default />)

      expect(await screen.findByText(purpose)).toBeInTheDocument()
      expect(screen.getByText(sample)).toBeInTheDocument()
      expect(screen.getByText("¥100,000")).toBeInTheDocument()
      expect(screen.getByText("¥68,000")).toBeInTheDocument()
      expect(screen.getByText(remaining)).toBeInTheDocument()
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuetext",
        expect.stringContaining(remaining),
      )
      for (const link of screen.getAllByRole("link", { name: start })) {
        expect(link).toHaveAttribute("href", "/auth")
      }
    },
  )
})

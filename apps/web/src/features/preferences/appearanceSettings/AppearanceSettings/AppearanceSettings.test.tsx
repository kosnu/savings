import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test"

import { i18next } from "../../../../i18n"
import { LanguageSyncProvider } from "../../../../providers/language/LanguageSyncProvider"
import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./AppearanceSettings.stories"

const { Default } = composeStories(stories)

describe("AppearanceSettings", () => {
  beforeEach(async () => {
    window.localStorage.clear()
    document.documentElement.classList.remove("dark")
    await i18next.changeLanguage("en")
  })

  afterEach(async () => {
    await i18next.changeLanguage("en")
    window.localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  test("現在の言語とテーマを表示し、選択した値を既存のlocalStorageへ保存する", async () => {
    const { user } = render(<Default />)

    const languageSelect = screen.getByRole("combobox", { name: "Language" })
    const themeSelect = screen.getByRole("combobox", { name: "Theme" })
    expect(languageSelect).toHaveTextContent("English")
    expect(themeSelect).toHaveTextContent("Light")

    await user.click(themeSelect)
    await user.click(await screen.findByRole("option", { name: "Dark" }))

    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveTextContent("Dark")
    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("dark")
      expect(document.documentElement).toHaveClass("dark")
    })

    await user.click(languageSelect)
    await user.click(await screen.findByRole("option", { name: "Japanese" }))

    expect(screen.getByRole("combobox", { name: "言語" })).toHaveTextContent("日本語")
    expect(screen.getByRole("combobox", { name: "テーマ" })).toHaveTextContent("ダーク")
    expect(window.localStorage.getItem("appLanguage")).toBe("ja")
  })

  test("アカウント保存に失敗した場合は変更前の言語へ戻す", async () => {
    server.resetHandlers(
      ...createProfileHandlers({
        update: { error: true, errorResponse: { message: "Failed to save language." } },
      }),
    )
    const { user } = render(<Default />)

    await user.click(screen.getByRole("combobox", { name: "Language" }))
    await user.click(await screen.findByRole("option", { name: "Japanese" }))

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")
      expect(window.localStorage.getItem("appLanguage")).toBe("en")
    })
  })

  test("アカウント保存後の確認失敗を通知し、writeを繰り返さず再確認する", async () => {
    let getRequestCount = 0
    let patchRequestCount = 0
    server.resetHandlers(
      http.get("*/rest/v1/users*", () => {
        getRequestCount += 1

        if (getRequestCount === 2 || getRequestCount === 3) {
          return HttpResponse.json({ message: "Failed to fetch profile." }, { status: 500 })
        }

        return HttpResponse.json({
          name: "Test User",
          email: "test@example.com",
          language: getRequestCount === 1 ? "en" : "ja",
        })
      }),
      http.patch("*/rest/v1/users*", () => {
        patchRequestCount += 1
        return HttpResponse.json({ auth_user_id: "mock-user-id" })
      }),
    )
    const { user } = render(
      <LanguageSyncProvider>
        <Default />
      </LanguageSyncProvider>,
    )

    const languageSelect = await screen.findByRole("combobox", { name: "Language" })
    await user.click(languageSelect)
    await user.click(await screen.findByRole("option", { name: "Japanese" }))

    expect(
      await screen.findByText("言語は保存されましたが、アカウント設定を確認できませんでした。"),
    ).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "言語" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "言語" })).toHaveTextContent("日本語")
    expect(window.localStorage.getItem("appLanguage")).toBe("ja")
    expect(patchRequestCount).toBe(1)
    expect(getRequestCount).toBe(2)

    const retryButton = screen.getByRole("button", { name: "もう一度確認" })
    await user.click(retryButton)

    await waitFor(() => {
      expect(retryButton).toBeEnabled()
      expect(getRequestCount).toBe(3)
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(patchRequestCount).toBe(1)

    await user.click(retryButton)

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(screen.getByRole("combobox", { name: "言語" })).toBeEnabled()
      expect(getRequestCount).toBe(4)
    })
    expect(screen.getByRole("combobox", { name: "言語" })).toHaveTextContent("日本語")
    expect(patchRequestCount).toBe(1)
  })
})

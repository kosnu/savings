import { composeStories } from "@storybook/react-vite"
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

  test("アカウント保存後の再取得に失敗した場合は変更後の言語を維持する", async () => {
    const { user } = render(
      <LanguageSyncProvider>
        <Default />
      </LanguageSyncProvider>,
    )

    const languageSelect = await screen.findByRole("combobox", { name: "Language" })
    server.resetHandlers(...createProfileHandlers({ get: { error: true } }))

    await user.click(languageSelect)
    await user.click(await screen.findByRole("option", { name: "Japanese" }))

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "言語" })).toHaveTextContent("日本語")
      expect(window.localStorage.getItem("appLanguage")).toBe("ja")
    })
  })
})

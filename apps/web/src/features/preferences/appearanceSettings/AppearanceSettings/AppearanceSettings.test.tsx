import { composeStories } from "@storybook/react-vite"
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test"

import { i18next } from "../../../../i18n"
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
    server.resetHandlers(...createProfileHandlers())
  })

  afterEach(async () => {
    await i18next.changeLanguage("en")
    window.localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  test("言語をaccountへ保存して確認後に反映し、テーマの端末内保存も維持する", async () => {
    const { user } = render(<Default />)

    const languageSelect = screen.getByRole("combobox", { name: "Language" })
    const themeSelect = screen.getByRole("combobox", { name: "Theme" })
    expect(languageSelect).toHaveTextContent("English")
    await waitFor(() => expect(languageSelect).toBeEnabled())
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

    expect(await screen.findByText("言語設定を保存しました。")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "言語" })).toHaveTextContent("日本語")
    expect(screen.getByRole("combobox", { name: "テーマ" })).toHaveTextContent("ダーク")
    expect(window.localStorage.getItem("appLanguage")).toBe("ja")
  })

  test("保存に失敗した場合は言語とlocalStorageを変更せず、成功通知を出さない", async () => {
    server.resetHandlers(...createProfileHandlers({ update: { error: true } }))
    const { user } = render(<Default />)
    const languageSelect = screen.getByRole("combobox", { name: "Language" })
    await waitFor(() => expect(languageSelect).toBeEnabled())

    await user.click(languageSelect)
    await user.click(await screen.findByRole("option", { name: "Japanese" }))

    expect(
      await screen.findByText(
        "Could not save the language. Your previous language is still active.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")
    expect(window.localStorage.getItem("appLanguage")).toBe("en")
    expect(screen.queryByText("Language preference saved.")).not.toBeInTheDocument()
  })

  test("保存後の再取得に失敗した場合も未確認の言語を反映しない", async () => {
    server.resetHandlers(...createProfileHandlers({ get: { errorAfterUpdate: true } }))
    const { user } = render(<Default />)
    const languageSelect = screen.getByRole("combobox", { name: "Language" })
    await waitFor(() => expect(languageSelect).toBeEnabled())

    await user.click(languageSelect)
    await user.click(await screen.findByRole("option", { name: "Japanese" }))

    expect(
      await screen.findByText(
        "Could not save the language. Your previous language is still active.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")
    expect(window.localStorage.getItem("appLanguage")).toBe("en")
    expect(screen.queryByText("Language preference saved.")).not.toBeInTheDocument()
  })
})

import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, expect, test } from "vite-plus/test"

import { i18next } from "../../../../i18n"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./AppearanceSettings.stories"

const { Default } = composeStories(stories)

const testNamePattern = (
  globalThis as typeof globalThis & {
    __vitest_worker__?: { config: { testNamePattern?: RegExp } }
  }
).__vitest_worker__?.config.testNamePattern

function testCase(name: string, callback: () => void | Promise<void>) {
  if (testNamePattern && !testNamePattern.test(name)) {
    return
  }

  test(name, callback)
}

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

testCase("選択した言語をアカウントへ保存する", async () => {
  let requestBody: unknown
  server.use(
    http.patch("*/rest/v1/users*", async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ auth_user_id: "mock-user-id" })
    }),
  )

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
  expect(requestBody).toEqual({ language: "ja" })
})

testCase("保存失敗では表示言語を戻してエラーを表示する", async () => {
  server.use(
    http.patch("*/rest/v1/users*", () =>
      HttpResponse.json({ message: "Failed to save account language." }, { status: 500 }),
    ),
  )

  const { user } = render(<Default />)
  await user.click(screen.getByRole("combobox", { name: "Language" }))
  await user.click(await screen.findByRole("option", { name: "Japanese" }))

  expect(await screen.findByText("Could not save your language.")).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")
})

testCase("日本語と英語の表示を切り替えられる", async () => {
  server.use(
    http.patch("*/rest/v1/users*", () => HttpResponse.json({ auth_user_id: "mock-user-id" })),
  )

  const { user } = render(<Default />)

  await user.click(screen.getByRole("combobox", { name: "Language" }))
  await user.click(await screen.findByRole("option", { name: "Japanese" }))
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: "言語" })).toHaveTextContent("日本語")
  })

  await user.click(screen.getByRole("combobox", { name: "言語" }))
  await user.click(await screen.findByRole("option", { name: "英語" }))
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")
  })
})

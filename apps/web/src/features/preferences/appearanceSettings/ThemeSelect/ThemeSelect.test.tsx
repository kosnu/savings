import { composeStories } from "@storybook/react-vite"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"

import { i18next } from "../../../../i18n"
import { act, cleanup, render, screen } from "../../../../test/test-utils"
import * as stories from "./ThemeSelect.stories"

const { Default } = composeStories(stories)

beforeEach(async () => {
  localStorage.clear()
  await i18next.changeLanguage("en")
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove("dark")
  await i18next.changeLanguage("en")
})

test("テーマを3種類から選択して保存でき、システム選択は再表示後も維持される", async () => {
  const { user, unmount, container } = render(<Default />)
  const select = screen.getByRole("combobox", { name: "Theme" })
  expect(select).toHaveTextContent("System")

  for (const [label, value] of [
    ["Dark", "dark"],
    ["Light", "light"],
    ["System", "system"],
  ]) {
    await user.click(select)
    expect(screen.getAllByRole("option")).toHaveLength(3)
    await user.click(screen.getByRole("option", { name: label }))

    expect(select).toHaveTextContent(label)
    expect(localStorage.getItem("theme")).toBe(value)
    const radixTheme = container.querySelector(".radix-themes")
    expect(radixTheme).toBeInTheDocument()
    expect(radixTheme).toHaveClass(value === "dark" ? "dark" : "light")
  }

  unmount()
  render(<Default />)
  expect(screen.getByRole("combobox", { name: "Theme" })).toHaveTextContent("System")
})

test("日本語でもシステム・ライト・ダークを選択できる", async () => {
  await i18next.changeLanguage("ja")
  const { user } = render(<Default />)
  const select = screen.getByRole("combobox", { name: "テーマ" })
  expect(select).toHaveTextContent("システム")
  await user.click(select)

  expect(screen.getByRole("option", { name: "システム" })).toBeInTheDocument()
  expect(screen.getByRole("option", { name: "ライト" })).toBeInTheDocument()
  await user.click(screen.getByRole("option", { name: "ダーク" }))
  expect(select).toHaveTextContent("ダーク")
  expect(localStorage.getItem("theme")).toBe("dark")
})

test("システム配色の変更で表示色だけが変わり、選択欄はシステムのままになる", () => {
  const mediaQuery = Object.assign(new EventTarget(), {
    matches: true,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })
  vi.spyOn(window, "matchMedia").mockReturnValue(mediaQuery)
  const { container } = render(<Default />)
  const radixTheme = container.querySelector(".radix-themes")
  expect(radixTheme).toBeInTheDocument()
  expect(radixTheme).toHaveClass("dark")
  expect(document.documentElement).toHaveClass("dark")

  act(() => {
    mediaQuery.matches = false
    mediaQuery.dispatchEvent(new Event("change"))
  })

  expect(radixTheme).toHaveClass("light")
  expect(document.documentElement).not.toHaveClass("dark")
  expect(screen.getByRole("combobox", { name: "Theme" })).toHaveTextContent("System")
  expect(localStorage.getItem("theme")).toBe("system")
})

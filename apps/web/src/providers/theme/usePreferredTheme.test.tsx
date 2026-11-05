import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"

import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import entryHtml from "../../../index.html?raw"
import { act, cleanup, renderHook } from "../../test/test-utils"
import { usePreferredTheme } from "./usePreferredTheme"

let mediaQuery: MediaQueryList
let themeColor: HTMLMetaElement
let themeStyles: HTMLStyleElement

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
  themeColor = document.createElement("meta")
  themeColor.name = "theme-color"
  themeColor.content = "#ffffff"
  themeStyles = document.createElement("style")
  themeStyles.textContent = ["radixLightTheme.css", "radixDarkTheme.css"]
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n")
  document.head.append(themeColor, themeStyles)
  mediaQuery = Object.assign(new EventTarget(), {
    matches: false,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })
  vi.spyOn(window, "matchMedia").mockReturnValue(mediaQuery)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove("dark")
  themeColor.remove()
  themeStyles.remove()
})

function changeSystemTheme(dark: boolean) {
  act(() => {
    Object.assign(mediaQuery, { matches: dark })
    mediaQuery.dispatchEvent(new Event("change"))
  })
}

describe("ページ起動時の配色", () => {
  // React起動後のhook検証では検出できないため、実際のHTMLの初期化処理を実行する。
  const entryDocument = new DOMParser().parseFromString(entryHtml, "text/html")
  const startupScript = entryDocument.querySelector("head script:not([src])")
  if (!startupScript?.textContent) throw new Error("起動時の配色初期化が必要です")
  const startupCode = startupScript.textContent

  function initializeTheme() {
    runInNewContext(startupCode, { document, window, localStorage, getComputedStyle })
  }

  test.each([
    ["light", false, false],
    ["light", true, false],
    ["dark", false, true],
    ["dark", true, true],
    ["system", false, false],
    ["system", true, true],
    [null, false, false],
    [null, true, true],
    ["invalid", false, false],
    ["invalid", true, true],
  ] as const)(
    "React未起動でも設定=%s・OSダーク=%sからダーク=%sを適用する",
    (preference, systemDark, expectedDark) => {
      if (preference !== null) localStorage.setItem("theme", preference)
      Object.assign(mediaQuery, { matches: systemDark })

      initializeTheme()

      expect(document.documentElement.classList.contains("dark")).toBe(expectedDark)
      expect(themeColor.content).toBe(expectedDark ? "#111" : "#fff")
      const { result } = renderHook(usePreferredTheme, { withProviders: false })
      expect(result.current.theme).toBe(expectedDark ? "dark" : "light")
      expect(themeColor.content).toBe(expectedDark ? "#111" : "#fff")
    },
  )

  test.each([false, true])("保存設定を読めなくてもOS配色で起動する (dark=%s)", (dark) => {
    Object.assign(mediaQuery, { matches: dark })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError")
    })

    initializeTheme()
    expect(themeColor.content).toBe(dark ? "#111" : "#fff")
    const { result } = renderHook(usePreferredTheme, { withProviders: false })
    expect(result.current.theme).toBe(dark ? "dark" : "light")
    act(() => result.current.changeTheme(dark ? "light" : "dark"))
    expect(themeColor.content).toBe(dark ? "#fff" : "#111")
  })
})

describe("usePreferredTheme", () => {
  test.each(["light", "dark"] as const)(
    "保存済みの %s 配色をブラウザのテーマ色へ反映する",
    (theme) => {
      localStorage.setItem("theme", theme)
      Object.assign(mediaQuery, { matches: theme !== "dark" })
      renderHook(usePreferredTheme, { withProviders: false })

      expect(themeColor.content).toBe(theme === "dark" ? "#111" : "#fff")
    },
  )

  test("ブラウザのテーマ色がシステム配色とアプリの設定変更に追従する", () => {
    const { result } = renderHook(usePreferredTheme, { withProviders: false })
    expect(themeColor.content).toBe("#fff")

    changeSystemTheme(true)
    expect(themeColor.content).toBe("#111")
    changeSystemTheme(false)
    expect(themeColor.content).toBe("#fff")

    act(() => result.current.changeTheme("dark"))
    expect(themeColor.content).toBe("#111")
    changeSystemTheme(true)
    changeSystemTheme(false)
    expect(themeColor.content).toBe("#111")

    act(() => result.current.changeTheme("light"))
    expect(themeColor.content).toBe("#fff")
    changeSystemTheme(true)
    expect(themeColor.content).toBe("#fff")

    act(() => result.current.changeTheme("system"))
    expect(themeColor.content).toBe("#111")
  })

  test.each([false, true])("保存値がない場合はシステム配色を使う (dark=%s)", (dark) => {
    Object.assign(mediaQuery, { matches: dark })
    const { result } = renderHook(usePreferredTheme, { withProviders: false })

    expect(result.current.themePreference).toBe("system")
    expect(result.current.theme).toBe(dark ? "dark" : "light")
    expect(document.documentElement.classList.contains("dark")).toBe(dark)
    expect(localStorage.getItem("theme")).toBe("system")
  })

  test("不正な保存値はシステム設定として扱う", () => {
    localStorage.setItem("theme", "invalid")
    const { result } = renderHook(usePreferredTheme, { withProviders: false })

    expect(result.current.themePreference).toBe("system")
    expect(result.current.theme).toBe("light")
    expect(localStorage.getItem("theme")).toBe("system")
  })

  test("システムの配色変更に双方向で追従し、再読み込み後もシステムを維持する", () => {
    localStorage.setItem("theme", "system")
    const { result, unmount } = renderHook(usePreferredTheme, { withProviders: false })

    changeSystemTheme(true)
    expect(result.current.theme).toBe("dark")
    expect(document.documentElement).toHaveClass("dark")
    changeSystemTheme(false)
    expect(result.current.theme).toBe("light")
    expect(document.documentElement).not.toHaveClass("dark")
    expect(result.current.themePreference).toBe("system")
    expect(localStorage.getItem("theme")).toBe("system")

    unmount()
    changeSystemTheme(true)
    const reloaded = renderHook(usePreferredTheme, { withProviders: false })
    expect(reloaded.result.current.themePreference).toBe("system")
    expect(reloaded.result.current.theme).toBe("dark")
  })

  test.each(["light", "dark"] as const)(
    "既存の保存値 %s を維持し、システム側の変更では上書きしない",
    (theme) => {
      Object.assign(mediaQuery, { matches: theme === "light" })
      localStorage.setItem("theme", theme)
      const { result } = renderHook(usePreferredTheme, { withProviders: false })

      expect(result.current.themePreference).toBe(theme)
      expect(result.current.theme).toBe(theme)
      changeSystemTheme(false)
      changeSystemTheme(true)
      expect(result.current.theme).toBe(theme)
      expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark")
      expect(localStorage.getItem("theme")).toBe(theme)
    },
  )

  test.each(["light", "dark"] as const)(
    "%s を選択すると固定され、再読み込み後も維持される",
    (theme) => {
      const { result, unmount } = renderHook(usePreferredTheme, { withProviders: false })
      act(() => result.current.changeTheme(theme))
      changeSystemTheme(false)
      changeSystemTheme(true)
      expect(result.current.themePreference).toBe(theme)
      expect(result.current.theme).toBe(theme)
      expect(localStorage.getItem("theme")).toBe(theme)

      unmount()
      const reloaded = renderHook(usePreferredTheme, { withProviders: false })
      expect(reloaded.result.current.themePreference).toBe(theme)
      expect(reloaded.result.current.theme).toBe(theme)
    },
  )

  test("固定からシステムへ戻すと最新の配色を即時反映して追従を再開する", () => {
    localStorage.setItem("theme", "light")
    const { result } = renderHook(usePreferredTheme, { withProviders: false })
    changeSystemTheme(true)
    expect(result.current.theme).toBe("light")

    act(() => result.current.changeTheme("system"))
    expect(result.current.theme).toBe("dark")
    expect(localStorage.getItem("theme")).toBe("system")
    changeSystemTheme(false)
    expect(result.current.theme).toBe("light")
  })

  test.each([false, true])(
    "トグルは表示中のシステム配色の反対色に固定し、再度切り替えられる (dark=%s)",
    (dark) => {
      const { result } = renderHook(usePreferredTheme, { withProviders: false })
      changeSystemTheme(dark)
      act(() => result.current.toggleTheme())
      expect(result.current.themePreference).toBe(dark ? "light" : "dark")
      expect(result.current.theme).toBe(dark ? "light" : "dark")
      expect(localStorage.getItem("theme")).toBe(dark ? "light" : "dark")
      changeSystemTheme(!dark)
      changeSystemTheme(dark)
      expect(result.current.theme).toBe(dark ? "light" : "dark")

      act(() => result.current.toggleTheme())
      expect(result.current.theme).toBe(dark ? "dark" : "light")
    },
  )

  test("アンマウント時にシステム配色の購読を解除する", () => {
    const add = vi.spyOn(mediaQuery, "addEventListener")
    const remove = vi.spyOn(mediaQuery, "removeEventListener")
    const { unmount } = renderHook(usePreferredTheme, { withProviders: false })
    const subscription = add.mock.calls.find(([event]) => event === "change")
    if (!subscription) throw new Error("配色変更の購読が必要です")
    const listener = subscription[1]

    unmount()
    expect(remove).toHaveBeenCalledWith("change", listener)
  })
})

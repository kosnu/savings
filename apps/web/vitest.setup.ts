import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vite-plus/test"

class TestStorage implements Storage {
  #items = new Map<string, string>()

  get length() {
    return this.#items.size
  }

  clear() {
    this.#items.clear()
  }

  getItem(key: string) {
    return this.#items.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.#items.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.#items.delete(key)
  }

  setItem(key: string, value: string) {
    this.#items.set(key, value)
  }
}

// Node v26のjsdomではlocalStorageが自動提供されないため、既存テスト用に明示します。
const localStorage = new TestStorage()

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorage,
})

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorage,
})

await import("./src/i18n")

afterEach(() => {
  cleanup()
})

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserver

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

window.scrollTo = () => {}

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

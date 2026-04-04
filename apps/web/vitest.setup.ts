import { cleanup } from "@testing-library/react"
import { setDefaultOptions } from "date-fns"
import { ja } from "date-fns/locale"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

setDefaultOptions({ locale: ja })

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

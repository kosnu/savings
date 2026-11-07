import { afterEach, expect, test, vi } from "vite-plus/test"

import { animateFlame } from "./animateFlame"

afterEach(() => vi.restoreAllMocks())

test("静止設定を尊重し、再開時は炎の輪郭だけを動かし、終了時に停止する", () => {
  // 時刻とOS設定の途中変更を直接駆動するため、描画helperの境界で確認する。
  const media = Object.assign(new EventTarget(), {
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }) as MediaQueryList
  vi.spyOn(window, "matchMedia").mockReturnValue(media)
  vi.spyOn(performance, "now").mockReturnValue(0)
  let next: FrameRequestCallback | undefined
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    next = callback
    return 1
  })
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
    next = undefined
  })
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  const stop = animateFlame(svg, "logo-test")
  if (!stop) throw new Error("SVGの組み立てが必要です")
  try {
    const flames = Array.from(svg.querySelectorAll("[data-flame] path"))
    const note = svg.querySelector("[data-note]")
    if (!note || flames.length === 0) throw new Error("炎とお札を分離したパスが必要です")
    const original = flames.map((path) => path.getAttribute("d"))
    const fixedNote = note.innerHTML
    expect(svg.querySelector("image")).toBeNull()
    expect(svg.dataset.ready).toBe("true")
    expect(request).not.toHaveBeenCalled()

    Object.assign(media, { matches: false })
    media.dispatchEvent(new Event("change"))
    if (!next) throw new Error("静止設定の解除後は描画を再開する必要があります")
    next(1000)
    expect(flames.map((path) => path.getAttribute("d"))).not.toEqual(original)
    expect(note.innerHTML).toBe(fixedNote)

    Object.assign(media, { matches: true })
    media.dispatchEvent(new Event("change"))
    expect(next).toBeUndefined()
    expect(flames.map((path) => path.getAttribute("d"))).toEqual(original)
    expect(note.innerHTML).toBe(fixedNote)
  } finally {
    stop()
  }
  const calls = request.mock.calls.length
  Object.assign(media, { matches: false })
  media.dispatchEvent(new Event("change"))
  expect(request).toHaveBeenCalledTimes(calls)
  expect(svg.childElementCount).toBe(0)
  expect(svg.dataset.ready).toBeUndefined()
})

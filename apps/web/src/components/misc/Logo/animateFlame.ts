import artwork from "./logoArtwork.svg?raw"

function noise(value: number) {
  const cell = Math.floor(value)
  const fraction = value - cell
  const blend = fraction * fraction * (3 - 2 * fraction)
  const a = Math.sin(cell * 127.1 + 311.7) * 43758.5453
  const b = Math.sin((cell + 1) * 127.1 + 311.7) * 43758.5453
  return ((a - Math.floor(a)) * 2 - 1) * (1 - blend) + ((b - Math.floor(b)) * 2 - 1) * blend
}

function smooth(from: number, to: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

// SVGの制御点を動かす。お札と、その境界の制御点は固定する。
function point(x: number, y: number) {
  const edges = [
    [151, 364, 350, 258],
    [350, 258, 401, 375],
    [401, 375, 250, 470],
    [250, 470, 151, 364],
  ] as const
  let distance = Infinity
  for (const [ax, ay, bx, by] of edges) {
    distance = Math.min(
      distance,
      ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / Math.hypot(bx - ax, by - ay),
    )
  }
  return { x, y, rise: Math.max(0, Math.min(1, (468 - y) / 437)), free: smooth(3, 40, -distance) }
}

export function animateFlame(svg: SVGSVGElement, prefix: string) {
  const parsed = new DOMParser().parseFromString(artwork, "image/svg+xml")
  if (parsed.querySelector("parsererror")) return

  // 同じ画面の複数のロゴでグラデーションの参照先が混ざらないようにする。
  for (const node of parsed.querySelectorAll("[id]")) node.id = `${prefix}-${node.id}`
  for (const node of parsed.querySelectorAll("[fill]")) {
    const fill = node.getAttribute("fill") ?? ""
    if (fill.startsWith("url(#"))
      node.setAttribute("fill", fill.replace("url(#", `url(#${prefix}-`))
  }
  svg.replaceChildren(...Array.from(parsed.documentElement.children))

  const contours = Array.from(
    svg.querySelectorAll<SVGPathElement>("[data-flame] path"),
    (element) => {
      const original = element.getAttribute("d") ?? ""
      const parts = original.split(/(-?\d+(?:\.\d+)?)/)
      const points = Array.from(
        original.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g),
        (match) => point(Number(match[1]), Number(match[2])),
      )
      return { element, original, parts, points }
    },
  )
  const gradients = Array.from(
    svg.querySelectorAll<SVGLinearGradientElement>("[data-flame-gradient]"),
    (element) => {
      const original = {
        x1: element.getAttribute("x1") ?? "0",
        y1: element.getAttribute("y1") ?? "0",
        x2: element.getAttribute("x2") ?? "0",
        y2: element.getAttribute("y2") ?? "0",
      }
      return {
        element,
        original,
        start: point(Number(original.x1), Number(original.y1)),
        end: point(Number(original.x2), Number(original.y2)),
      }
    },
  )
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let frame = 0
  let started = 0
  let last = 0
  let disposed = false

  function restore() {
    for (const contour of contours) contour.element.setAttribute("d", contour.original)
    for (const gradient of gradients) {
      for (const key of ["x1", "y1", "x2", "y2"] as const)
        gradient.element.setAttribute(key, gradient.original[key])
    }
  }

  function draw(now: number) {
    if (disposed) return
    if (now - last >= 1000 / 30) {
      last = now - ((now - last) % (1000 / 30))
      const time = (now - started) / 1000
      const wind = noise(time * 0.75 + 17.3)
      const stretch = noise(time * 1.3 + 4.7) * 0.045 - 0.015
      const intro = smooth(0, 0.4, time)
      function move(p: ReturnType<typeof point>) {
        const flow = time * 1.5 + p.y * 0.004
        const bend = (25 * wind + 26 * noise(flow + 13)) * p.rise ** 2
        const tip = 16 * noise(time * 2.6 + p.x * 0.008 + 5) * p.rise ** 4
        const body = smooth(250, 340, p.y) * (1 - smooth(350, 470, p.y))
        const breath = noise(flow + 50) * body
        const dx = bend + tip + (p.x - 255) * 0.065 * breath
        const dy = -(468 - p.y) * stretch - 6 * p.rise * noise(flow + 7) - 8 * breath
        return [p.x + dx * p.free * intro, p.y + dy * p.free * intro] as const
      }
      for (const contour of contours) {
        contour.points.forEach((p, i) => {
          const [x, y] = move(p)
          contour.parts[i * 4 + 1] = x.toFixed(2)
          contour.parts[i * 4 + 3] = y.toFixed(2)
        })
        contour.element.setAttribute("d", contour.parts.join(""))
      }
      for (const gradient of gradients) {
        const [x1, y1] = move(gradient.start)
        const [x2, y2] = move(gradient.end)
        gradient.element.setAttribute("x1", x1.toFixed(2))
        gradient.element.setAttribute("y1", y1.toFixed(2))
        gradient.element.setAttribute("x2", x2.toFixed(2))
        gradient.element.setAttribute("y2", y2.toFixed(2))
      }
    }
    frame = requestAnimationFrame(draw)
  }

  function updateMotion() {
    cancelAnimationFrame(frame)
    restore()
    started = performance.now()
    last = started - 1000 / 30
    if (!reducedMotion.matches) frame = requestAnimationFrame(draw)
  }

  svg.dataset.ready = "true"
  reducedMotion.addEventListener("change", updateMotion)
  updateMotion()
  return () => {
    disposed = true
    cancelAnimationFrame(frame)
    reducedMotion.removeEventListener("change", updateMotion)
    svg.removeAttribute("data-ready")
    svg.replaceChildren()
  }
}

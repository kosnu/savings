// Pixel の初回タップを観測するための一時診断。
export function traceCategorySelect(triggerId: string) {
  const controller = new AbortController()
  const capture = { capture: true, signal: controller.signal }
  const viewport = window.visualViewport
  const rows: { event: string; text: string }[] = []
  let startedAt: number | undefined
  let timer: number | undefined
  const panelId = "category-select-trace"
  document.getElementById(panelId)?.remove()

  const dimensions = () =>
    `W ${window.innerWidth}×${window.innerHeight} / V ${Math.round(viewport?.width ?? 0)}×${Math.round(viewport?.height ?? 0)}`

  const record = (event: string, detail = "", coalesce = false) => {
    if (startedAt === undefined || controller.signal.aborted) return
    const elapsed = Math.round(performance.now() - startedAt)
    if (coalesce && rows[rows.length - 1]?.event === event) rows.pop()
    rows.push({ event, text: `+${elapsed} ${event} ${detail}`.trimEnd() })
  }

  const show = () => {
    controller.abort()
    const panel = document.createElement("pre")
    panel.id = panelId
    panel.setAttribute("aria-hidden", "true")
    panel.style.cssText =
      "position:fixed;inset:auto 0 0;z-index:2147483647;margin:0;padding:8px 8px max(8px, env(safe-area-inset-bottom));background:#161616;color:white;font:14px/1.2 monospace;white-space:pre-wrap;pointer-events:none"
    const visibleRows =
      rows.length > 21 ? [...rows.slice(0, 12), { text: "…" }, ...rows.slice(-8)] : rows
    panel.textContent = [
      "カテゴリ診断 v1 (+ms)",
      ...visibleRows.map((row) => row.text),
      dimensions(),
    ].join("\n")
    document.body.append(panel)
  }

  const targetName = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return target === window ? "window" : "-"
    if (target.closest('[role="combobox"]')?.id === triggerId) return "category"
    if (target.closest('[role="option"]')) return "option"
    if (target.closest('[role="listbox"]')) return "list"
    if (target instanceof HTMLInputElement && target.inputMode === "numeric") return "amount"
    return target.localName
  }

  const pointer = (event: PointerEvent) => {
    const target = targetName(event.target)
    if (startedAt === undefined) {
      if (target !== "category" || event.type === "pointermove") return

      startedAt = performance.now()
      record("start", dimensions())
      record("focus", targetName(document.activeElement))
      timer = window.setTimeout(show, 900)
    }
    const type = event.type.replace("pointer", "")
    const hit = targetName(document.elementFromPoint(event.clientX, event.clientY))
    const top = document.getElementById(triggerId)?.getBoundingClientRect().top
    record(
      type,
      `${target} ${event.pointerType} ${Math.round(event.clientX)},${Math.round(event.clientY)} hit=${hit} y=${Math.round(top ?? 0)}`,
      type === "move",
    )
  }

  document.addEventListener("pointerdown", pointer, capture)
  document.addEventListener("pointerup", pointer, capture)
  document.addEventListener("pointercancel", pointer, capture)
  document.addEventListener("pointermove", pointer, capture)
  document.addEventListener("click", pointer, capture)

  for (const type of ["focusin", "focusout"]) {
    document.addEventListener(type, (event) => record(type, targetName(event.target)), capture)
  }
  document.addEventListener(
    "dismissableLayer.pointerDownOutside",
    (event) => record("outside pointer", targetName(event.target)),
    capture,
  )
  document.addEventListener(
    "dismissableLayer.focusOutside",
    (event) => record("outside focus", targetName(event.target)),
    capture,
  )
  window.addEventListener("blur", () => record("window blur"), { signal: controller.signal })
  window.addEventListener("resize", () => record("window resize", dimensions()), capture)
  viewport?.addEventListener("resize", () => record("visual resize", dimensions(), true), capture)

  return {
    onOpenChange(open: boolean) {
      record(open ? "open" : "close", dimensions())
    },
    dispose() {
      window.clearTimeout(timer)
      if (startedAt !== undefined && !controller.signal.aborted) {
        record("field unmounted")
        show()
      }
      controller.abort()
    },
  }
}

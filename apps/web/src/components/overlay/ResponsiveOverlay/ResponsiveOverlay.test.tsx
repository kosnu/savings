import { useState } from "react"
import { afterEach, describe, expect, test } from "vitest"

import { render, screen } from "../../../test/test-utils"
import { MOBILE_OVERLAY_MEDIA_QUERY } from "../constants"
import { ResponsiveOverlay } from "./ResponsiveOverlay"

function createMatchMediaController(initialMatches: boolean) {
  const state = { matches: initialMatches }
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  window.matchMedia = ((query: string) =>
    ({
      get matches() {
        return state.matches
      },
      media: query,
      onchange: null,
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      },
      addEventListener: (_eventName: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_eventName: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      },
      dispatchEvent: (event: Event) => {
        listeners.forEach((listener) => listener(event as MediaQueryListEvent))
        return true
      },
    }) as MediaQueryList) as typeof window.matchMedia

  return {
    setMatches(nextMatches: boolean) {
      state.matches = nextMatches
      const event = {
        matches: state.matches,
        media: MOBILE_OVERLAY_MEDIA_QUERY,
      } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}

function OverlayHarness() {
  const [note, setNote] = useState("")

  return (
    <ResponsiveOverlay
      open
      onOpenChange={() => {}}
      title="Create payment"
      description="Create a new payment. Please fill in the details below."
    >
      <label htmlFor="note">Note</label>
      <input id="note" value={note} onChange={(event) => setNote(event.target.value)} />
    </ResponsiveOverlay>
  )
}

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe("ResponsiveOverlay", () => {
  test("desktop でも右上の閉じるボタンを表示する", async () => {
    createMatchMediaController(false)

    render(<OverlayHarness />)

    expect(await screen.findByRole("button", { name: /close create payment/i })).toBeInTheDocument()
  })

  test("should keep child state when the viewport switches while open", async () => {
    const controller = createMatchMediaController(false)
    const { user } = render(<OverlayHarness />)

    const overlay = await screen.findByRole("dialog", { name: /create payment/i })
    expect(overlay).toHaveAttribute("data-overlay-variant", "dialog")

    const noteInput = screen.getByRole("textbox", { name: /note/i })
    await user.type(noteInput, "responsive state")
    expect(noteInput).toHaveValue("responsive state")

    controller.setMatches(true)

    const sheetOverlay = await screen.findByRole("dialog", { name: /create payment/i })
    expect(sheetOverlay).toHaveAttribute("data-overlay-variant", "sheet")
    expect(screen.getByRole("textbox", { name: /note/i })).toHaveValue("responsive state")
  })
})

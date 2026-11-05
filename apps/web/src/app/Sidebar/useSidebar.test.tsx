import { beforeEach, describe, expect, test } from "vite-plus/test"

import { act, renderHook } from "../../test/test-utils"
import { useSidebar } from "./useSidebar"

describe("useSidebar", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test("保存済みの状態がない場合は閉じた状態で初期化する", () => {
    const { result } = renderHook(() => useSidebar())

    expect(result.current.open).toBe(false)
  })

  test("以前の開いた状態が保存されていても閉じた状態で初期化する", () => {
    window.localStorage.setItem("sidebarOpen", "true")

    const { result } = renderHook(() => useSidebar())

    expect(result.current.open).toBe(false)
  })

  test("開いた状態でアンマウントしても次の初期表示は閉じる", () => {
    const { result, unmount } = renderHook(() => useSidebar())

    act(() => {
      result.current.openSidebar()
    })

    expect(result.current.open).toBe(true)
    unmount()

    const { result: nextResult } = renderHook(() => useSidebar())

    expect(nextResult.current.open).toBe(false)
  })

  test("openSidebar で開き、closeSidebar で閉じる", () => {
    const { result } = renderHook(() => useSidebar())

    act(() => {
      result.current.openSidebar()
    })

    expect(result.current.open).toBe(true)

    act(() => {
      result.current.closeSidebar()
    })

    expect(result.current.open).toBe(false)
  })
})

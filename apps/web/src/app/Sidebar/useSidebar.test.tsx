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

  test("保存済みの状態がある場合は保存値を初期状態に使う", () => {
    window.localStorage.setItem("sidebarOpen", "true")

    const { result } = renderHook(() => useSidebar())

    expect(result.current.open).toBe(true)
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

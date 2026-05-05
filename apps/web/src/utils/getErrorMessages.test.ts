import { describe, expect, test } from "vite-plus/test"

import { getErrorMessages } from "./getErrorMessages"

describe("getErrorMessages", () => {
  test("message を持つエラーオブジェクトから message を返す", () => {
    expect(getErrorMessages([{ message: "Required" }, { message: "Invalid" }])).toEqual([
      "Required",
      "Invalid",
    ])
  })

  test("undefined のエラーは無視する", () => {
    expect(getErrorMessages([undefined, { message: "Invalid" }])).toEqual(["Invalid"])
  })

  test("抽出結果が空なら undefined を返す", () => {
    expect(getErrorMessages([])).toBeUndefined()
    expect(getErrorMessages([undefined])).toBeUndefined()
  })

  test("空文字は既存実装と同じく message として返す", () => {
    expect(getErrorMessages([{ message: "" }])).toEqual([""])
  })
})

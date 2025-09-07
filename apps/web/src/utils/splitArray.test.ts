import { describe, expect, it } from "vitest"
import { splitArray } from "./splitArray"

describe("splitArray", () => {
  it("配列を概ね均等に分割する", () => {
    const arr = [1, 2, 3, 4, 5]
    const [a, b, c] = splitArray(arr, 3)
    expect(a).toEqual([1, 2])
    expect(b).toEqual([3, 4])
    expect(c).toEqual([5])
  })

  it("要素数より大きい n は空のチャンクを含めて返す", () => {
    const arr = [1, 2]
    const [a, b, c] = splitArray(arr, 3)
    expect(a).toEqual([1])
    expect(b).toEqual([2])
    expect(c).toEqual([])
  })

  it("n が 1 のときは元配列と同じ内容の配列を返す（コピーされている）", () => {
    const arr = [1, 2, 3]
    const [a] = splitArray(arr, 1)
    expect(a).toEqual([1, 2, 3])
  })

  it("n が 0 以下または整数でない場合は例外を投げる", () => {
    expect(() => splitArray([], 0)).toThrow()
    expect(() => splitArray([], -1)).toThrow()
    // 小数は受け付けない
    expect(() => splitArray([], 1.5 as unknown as number)).toThrow()
  })

  it("空配列を分割すると空チャンクを返す", () => {
    const [a, b] = splitArray([], 2)
    expect(a).toEqual([])
    expect(b).toEqual([])
  })
})

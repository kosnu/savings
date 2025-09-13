import { expect, test } from "vitest"
import { foodCat } from "../../../test/data/categories"
import { getCategoryStrict, toCategoryMap } from "./toCategoryMap"

test("toCategoryMap", () => {
  const result = toCategoryMap([foodCat])

  expect(result.has(foodCat.id)).toBe(true)
  expect(result.size).toBe(1)
})

test("getCategoryStrict", () => {
  const map = toCategoryMap([foodCat])

  expect(getCategoryStrict(map, foodCat.id).name).toEqual(foodCat.name)
  expect(getCategoryStrict(map, "hoge").name).toEqual("Unknown")
})

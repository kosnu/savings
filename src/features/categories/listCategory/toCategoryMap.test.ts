import {test, expect} from "vitest"
import { getCategoryStrict, toCategoryMap } from "./toCategoryMap"
import { foodCat } from "../../../test/data/categories"

test("toCategoryMap", () => {
  const result = toCategoryMap([foodCat])

  expect(result.has(foodCat.id)).toBe(true)
  expect(result.size).toBe(1)
})

test("getCategoryStrict", () => {
  const map = toCategoryMap([foodCat])

  expect(getCategoryStrict(map, foodCat.id).name).toEqual(foodCat.name)
  expect(getCategoryStrict(map, "hoge").name).toEqual("Unknown category")
})

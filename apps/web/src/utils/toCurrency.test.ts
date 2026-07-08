import { expect, test } from "vite-plus/test"

import { toCurrency } from "./toCurrency"

test("toCurrency", () => {
  expect(toCurrency(1100)).toBe("¥1,100")
  expect(toCurrency(0)).toBe("¥0")
  expect(toCurrency(0.1)).toBe("¥0")
})

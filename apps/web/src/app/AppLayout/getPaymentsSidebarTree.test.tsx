import { expect, test } from "vitest"
import { getPaymentsSidebarTree } from "./getPaymentsSidebarTree"

test("getPaymentsSidebarTree", () => {
  const today = new Date(2023, 5, 1)

  const result = getPaymentsSidebarTree(today)

  expect(result.id).toEqual("title")
  expect(result.label).toEqual("Payments")
  expect(result.icon).toBeTruthy()
  expect(result.children.length).toEqual(2)
})

import { composeStories } from "@storybook/react-vite"
import { expect, test } from "vite-plus/test"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./AccountActionCallback.stories"

const { Default, Reactivated, Loading, Error } = composeStories(stories)
test("未着の予約はプロフィールへ戻り同じ受付で確認する", async () => {
  render(<Default />)
  expect(screen.getByRole("heading", { name: "Return to your account" })).toBeInTheDocument()
  expect(
    await screen.findByRole("link", { name: "Return to deletion confirmation" }),
  ).toHaveAttribute("href", "/settings/profile")
})
test("再有効化成功を通知して元のアカウントへ戻す", async () => {
  render(<Reactivated />)
  expect(await screen.findByRole("link", { name: "Continue to Burneto" })).toHaveAttribute(
    "href",
    "/",
  )
  expect(screen.getByRole("status")).toHaveTextContent("was cancelled")
})
test("callback処理中は通常画面や再送操作を表示しない", () => {
  render(<Loading />)
  expect(screen.getByRole("status")).toHaveTextContent("Verifying")
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
})
test("失敗時は再確認と匿名照会へ戻れる", async () => {
  render(<Error />)
  expect(await screen.findByRole("alert")).toHaveTextContent("failed or expired")
  expect(screen.getByRole("link", { name: "Check account deletion status" })).toHaveAttribute(
    "href",
    "/account-deletion",
  )
})

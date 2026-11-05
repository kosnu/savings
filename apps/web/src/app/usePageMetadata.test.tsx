import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { afterEach, expect, test } from "vite-plus/test"

import { i18next } from "../i18n"
import { act, render, renderHook, waitFor } from "../test/test-utils"
import { usePageMetadata } from "./usePageMetadata"

afterEach(async () => {
  await i18next.changeLanguage("en")
  document.head
    .querySelectorAll(
      'title, meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]',
    )
    .forEach((element) => element.remove())
})

// 表示を持たないhookのためStoryは使わず、実Routerの遷移と翻訳instanceを通す。
async function setup(initialEntry = "/") {
  const root = createRootRoute()
  const routeTree = root.addChildren(
    ["/", "/privacy", "/auth", "/payments", "/settings/profile"].map((path) =>
      createRoute({ getParentRoute: () => root, path }),
    ),
  )
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  render(<RouterProvider router={router} />, { withProviders: false })
  await router.load()
  const view = renderHook(({ authenticated }) => usePageMetadata(router, authenticated), {
    initialProps: { authenticated: false },
    withProviders: false,
  })
  return { router, view }
}

test("公開ページの遷移・言語変更でtitle、説明、正規URLと言語が更新される", async () => {
  await i18next.changeLanguage("ja")
  const { router } = await setup("/?year=2026&month=10")
  expect(document.title).toBe("Burneto | 予算と日々の支出を見比べられる家計簿")
  expect(document.documentElement.lang).toBe("ja")
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://burneto.com/",
  )

  await act(async () => router.navigate({ to: "/privacy" }))
  await waitFor(() => expect(document.title).toBe("プライバシーポリシー | Burneto"))
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
    "content",
    expect.stringContaining("保管・削除"),
  )
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://burneto.com/privacy",
  )

  await act(async () => i18next.changeLanguage("en"))
  expect(document.title).toBe("Privacy policy | Burneto")
  expect(document.documentElement.lang).toBe("en")
  expect(document.querySelector('meta[property="og:locale"]')).toHaveAttribute("content", "en_US")
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
    "content",
    expect.stringContaining("financial records"),
  )

  await act(async () => router.navigate({ to: "/" }))
  await waitFor(() =>
    expect(document.title).toBe("Burneto | Your budget and daily spending, together"),
  )
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1)
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "index, follow")
})

test.each(["/auth", "/payments", "/settings/profile"])(
  "%s への遷移は検索除外に切り替わり、公開ページの情報が残らない",
  async (to) => {
    const { router } = await setup()
    await act(async () => router.navigate({ to }))
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, follow",
      ),
    )
    expect(document.title).toBe("Burneto")
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.querySelector('meta[name="description"]')).toBeNull()
    expect(document.querySelector('meta[property="og:url"]')).toBeNull()

    await act(async () => router.navigate({ to: "/" }))
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        "content",
        "index, follow",
      ),
    )
  },
)

test("ログイン後のホームは検索除外とし、ログアウト後は公開ページの情報へ戻す", async () => {
  const { view } = await setup()
  view.rerender({ authenticated: true })
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  )
  expect(document.title).toBe("Burneto")
  expect(document.querySelector('meta[name="description"]')).toBeNull()
  view.rerender({ authenticated: false })
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "index, follow")
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://burneto.com/",
  )
})

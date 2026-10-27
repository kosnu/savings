import { readFileSync } from "node:fs"

import { expect, test } from "vite-plus/test"

import { withPageMetadata } from "../../seo"
import { getPageMetadata } from "../app/pageMetadata"

// 本番と同じHTML変換を通し、初回応答に出す情報を検査する。配信ヘッダーの適用は実ビルドで別途確認する。
test.each([
  ["/", "Burneto | 予算と日々の支出を見比べられる家計簿", "https://burneto.com/"],
  ["/privacy", "プライバシーポリシー | Burneto", "https://burneto.com/privacy"],
])("%s の初回HTMLにページ固有のメタ情報を出す", (path, title, canonical) => {
  const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
  const html = withPageMetadata(source, path)
  expect(html).toContain(`<title>${title}</title>`)
  expect(html).toContain(`<link rel="canonical" href="${canonical}" />`)
  expect(html).toContain('name="robots" content="index, follow"')
  expect(html).toContain('name="description"')
  expect(html).not.toContain('lang="en"')
})

test.each([
  "/auth",
  "/payments",
  "/payments/details/private-id",
  "/settings",
  "/unknown",
  "/privacy/extra",
])("公開対象でない %s は検索除外とし個人情報をメタ情報へ含めない", (pathname) => {
  expect(getPageMetadata(pathname, "ja")).toEqual({
    language: "ja",
    title: "Burneto",
    description: undefined,
    canonical: undefined,
    robots: "noindex, follow",
  })
})

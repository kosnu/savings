import type { Plugin } from "vite-plus"

import { getPageMetadata } from "./src/app/pageMetadata"

// 初回応答とSPA内の遷移で同じ公開ページ情報を使う。
export function withPageMetadata(html: string, pathname: string) {
  const metadata = getPageMetadata(pathname, "ja")
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  const tags = [
    `<title>${escape(metadata.title)}</title>`,
    `<meta name="robots" content="${metadata.robots}" />`,
    `<meta property="og:title" content="${escape(metadata.title)}" />`,
    `<meta property="og:locale" content="ja_JP" />`,
    `<meta name="twitter:title" content="${escape(metadata.title)}" />`,
    ...(metadata.description
      ? [
          `<meta name="description" content="${escape(metadata.description)}" />`,
          `<meta property="og:description" content="${escape(metadata.description)}" />`,
          `<meta name="twitter:description" content="${escape(metadata.description)}" />`,
        ]
      : []),
    ...(metadata.canonical
      ? [
          `<link rel="canonical" href="${metadata.canonical}" />`,
          `<meta property="og:url" content="${metadata.canonical}" />`,
        ]
      : []),
  ].join("\n    ")

  return html.replace(
    /<!-- page-metadata:start -->[\s\S]*?<!-- page-metadata:end -->/,
    `<!-- page-metadata:start -->\n    ${tags}\n    <!-- page-metadata:end -->`,
  )
}

export function publicPageSeo(): Plugin {
  return {
    name: "burneto-public-page-seo",
    transformIndexHtml(html, context) {
      const pathname = (context.originalUrl ?? context.path).split("?")[0]
      return withPageMetadata(html, pathname === "/index.html" ? "/" : pathname)
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"]
        if (index?.type !== "asset" || typeof index.source !== "string") return
        this.emitFile({
          type: "asset",
          fileName: "privacy.html",
          source: withPageMetadata(index.source, "/privacy"),
        })
      },
    },
  }
}

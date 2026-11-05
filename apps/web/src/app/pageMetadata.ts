const publicPages = {
  "/": {
    ja: {
      title: "Burneto | 予算と日々の支出を見比べられる家計簿",
      description:
        "Burnetoは、予算と日々の支出を見比べられる家計簿です。支払いを記録して、今月の支出や予算の残りを確認できます。",
    },
    en: {
      title: "Burneto | Your budget and daily spending, together",
      description:
        "Burneto is a budgeting app that brings your budget and daily spending together. Record payments and see your spending and remaining monthly budget.",
    },
  },
  "/privacy": {
    ja: {
      title: "プライバシーポリシー | Burneto",
      description:
        "Burnetoのアカウント情報や家計データの取り扱い、利用目的、外部への送信、保管・削除、お問い合わせについて説明します。",
    },
    en: {
      title: "Privacy policy | Burneto",
      description:
        "Learn how Burneto handles account information and financial records, including purposes of use, external infrastructure, storage, deletion and inquiries.",
    },
  },
} as const

export function getPageMetadata(pathname: string, language: "ja" | "en", authenticated = false) {
  const page = pathname === "/" || pathname === "/privacy" ? publicPages[pathname] : undefined
  const indexable = Boolean(page && !(pathname === "/" && authenticated))

  return {
    language,
    title: page && indexable ? page[language].title : "Burneto",
    description: page && indexable ? page[language].description : undefined,
    canonical: indexable ? `https://burneto.com${pathname}` : undefined,
    robots: indexable ? "index, follow" : "noindex, follow",
  }
}

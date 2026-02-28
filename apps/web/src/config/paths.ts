export const paths = {
  root: {
    getHref: () => "/",
  },
  auth: {
    getHref: () => "/auth",
  },
  payments: {
    getHref: (year?: string, month?: string) => {
      const params = new URLSearchParams()
      if (year) params.set("year", year)
      if (month) params.set("month", month)

      return `/payments${params.toString() ? `?${params.toString()}` : ""}`
    },
  },
  aggregates: {
    getHref: () => "/aggregates",
  },
} as const

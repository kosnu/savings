export const paths = {
  root: {
    path: "/",
    getHref: () => "/",
  },
  payments: {
    path: "/payments",
    getHref: (year?: string, month?: string) => {
      const params = new URLSearchParams()
      if (year) params.set("year", year)
      if (month) params.set("month", month)

      return `/payments${params.toString() ? `?${params.toString()}` : ""}`
    },
  },
  // Add more paths as needed
} as const

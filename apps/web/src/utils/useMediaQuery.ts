import { useMemo, useSyncExternalStore } from "react"

function createMediaQueryStore(query: string) {
  return {
    subscribe: (callback: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {}
      }

      const mediaQueryList = window.matchMedia(query)
      mediaQueryList.addEventListener("change", callback)

      return () => {
        mediaQueryList.removeEventListener("change", callback)
      }
    },
    getSnapshot: () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false
      }

      return window.matchMedia(query).matches
    },
    getServerSnapshot: () => false,
  }
}

export function useMediaQuery(query: string) {
  const store = useMemo(() => createMediaQueryStore(query), [query])

  // `matchMedia` は外部の購読ソースに近いため、
  // React の外部 store パターンに合わせて `useSyncExternalStore` で扱う。
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

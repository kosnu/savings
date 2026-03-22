import { useMemo, useSyncExternalStore } from "react"

function createMediaQueryStore(query: string) {
  const mediaQueryList =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query)
      : null

  return {
    subscribe: (callback: () => void) => {
      if (!mediaQueryList) {
        return () => {}
      }

      mediaQueryList.addEventListener("change", callback)

      return () => {
        mediaQueryList.removeEventListener("change", callback)
      }
    },
    getSnapshot: () => {
      if (!mediaQueryList) {
        return false
      }

      return mediaQueryList.matches
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

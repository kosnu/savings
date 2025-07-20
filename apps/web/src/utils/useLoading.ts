import { useCallback, useState } from "react"

interface UseLoadingReturn {
  loading: boolean
  startLoading: () => void
  finishLoading: () => void
}

export function useLoading(): UseLoadingReturn {
  const [loading, setLoading] = useState(false)

  const startLoading = useCallback(() => {
    setLoading(true)
  }, [])

  const finishLoading = useCallback(() => {
    setLoading(false)
  }, [])

  return {
    loading: loading,
    startLoading: startLoading,
    finishLoading: finishLoading,
  }
}

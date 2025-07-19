import { useCallback, useState } from "react"

interface UseToggleReturn {
  toggle: boolean
  switchToggle: () => void
}

export function useToggle(): UseToggleReturn {
  const [toggle, setToggle] = useState(false)

  const switchToggle = useCallback(() => {
    setToggle((prev) => !prev)
  }, [])

  return { toggle: toggle, switchToggle: switchToggle }
}

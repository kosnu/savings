import { stringifySearchWith } from "@tanstack/react-router"

export function parseSearch(searchStr: string) {
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr)
  const search: Record<string, unknown> = Object.create(null)

  for (const [key, value] of params.entries()) {
    const parsedValue = parseSearchValue(value)
    const previousValue = search[key]
    if (previousValue === undefined) {
      search[key] = parsedValue
    } else if (Array.isArray(previousValue)) {
      previousValue.push(parsedValue)
    } else {
      search[key] = [previousValue, parsedValue]
    }
  }

  return search
}

export const stringifySearch = stringifySearchWith(JSON.stringify)

function parseSearchValue(value: string): unknown {
  if (!value.startsWith("{") && !value.startsWith("[")) {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

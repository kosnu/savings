import type { Result } from "./result.ts"

export const unwrapOk = <T, E>(result: Result<T, E>): T => {
  if (!result.isOk) {
    throw result.error
  }

  return result.value
}

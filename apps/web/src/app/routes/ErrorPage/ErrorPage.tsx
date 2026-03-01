import type { ErrorComponentProps } from "@tanstack/react-router"
import { useId } from "react"

export function ErrorPage({ error }: ErrorComponentProps) {
  const id = useId()
  console.error(error)

  return (
    <div id={`error-page-${id}`}>
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      {error instanceof Error && (
        <p>
          <i>{error.message}</i>
        </p>
      )}
    </div>
  )
}

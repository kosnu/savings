import { useId } from "react"
import { useRouteError } from "react-router-dom"

export function ErrorPage() {
  const id = useId()
  const error = useRouteError()
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

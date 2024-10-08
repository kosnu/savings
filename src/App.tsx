import { AppProviders } from "./AppProviders"
import { RouterProvider } from "./utils/routes/RouterProvier"

function App() {
  return (
    <>
      <AppProviders>
        <RouterProvider />
      </AppProviders>
    </>
  )
}

export default App

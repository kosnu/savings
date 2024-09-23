import { AppProviders } from "./AppProviders"
import { TopPage } from "./pages/TopPage"

function App() {
  return (
    <>
      <AppProviders>
        <TopPage />
      </AppProviders>
    </>
  )
}

export default App

import { AppProviders } from "./components/AppProviders"
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

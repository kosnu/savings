import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./app"

// 最後に読み込む
import "./assets/global.css"
import "./assets/reset.css"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element not found")
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

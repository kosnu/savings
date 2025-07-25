import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./app"

// 最後に読み込む
import "./assets/global.module.css"

// biome-ignore lint: noNonNullAssertion
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

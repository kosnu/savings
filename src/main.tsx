import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./app"

import "@fontsource/roboto/300.css"
import "@fontsource/roboto/400.css"
import "@fontsource/roboto/500.css"
import "@fontsource/roboto/700.css"

// 最後に読み込む
import "./assets/global.module.css"

// biome-ignore lint: noNonNullAssertion
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

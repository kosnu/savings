import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { initSentry } from "./lib/sentry"

// 最後に読み込む
import "./assets/global.css"
import "./assets/reset.css"

// Sentry 初期化→App 遅延読み込み→レンダリングの順で起動する
async function bootstrap() {
  const rootElement = document.getElementById("root")

  if (!rootElement) {
    throw new Error("Root element not found")
  }

  initSentry()

  const { default: App } = await import("./app")

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()

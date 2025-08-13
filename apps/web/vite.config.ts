import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      localsConvention: "dashes",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("react-dom") ||
              id.includes("react-router-dom") ||
              id.includes("react")
            ) {
              return "vendor-react"
            }
            if (id.includes("firebase")) {
              return "vendor-firebase"
            }
            if (id.includes("@radix-ui")) {
              return "vendor-radix"
            }
            return "vendor"
          }
        },
      },
    },
  },
})

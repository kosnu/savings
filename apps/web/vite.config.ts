import { devtools as tanstackDevtools } from "@tanstack/devtools-vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tanstackDevtools()],
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

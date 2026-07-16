import { defineConfig } from "vite"

export default defineConfig({
  esbuild: {
    jsxInject: 'import React from "react"'
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api/lead": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lead/, ""),
        target: "http://127.0.0.1:8081"
      },
      "/api/portal": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/portal/, "/v1/portal"),
        target: "http://127.0.0.1:8081"
      }
    }
  }
})

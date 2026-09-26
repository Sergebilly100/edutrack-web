import { defineConfig } from "@playwright/test"

// All API requests in these UI checks are intercepted; no local tenant is used.
export default defineConfig({
  testDir: "./e2e/review",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5187", browserName: "chromium", screenshot: "only-on-failure" },
  webServer: {
    command: "VITE_API_URL=http://127.0.0.1:3999/api/v1 npm run dev -- --host 127.0.0.1 --port 5187 --strictPort",
    url: "http://127.0.0.1:5187",
    reuseExistingServer: false,
  },
})

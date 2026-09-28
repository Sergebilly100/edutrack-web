import { defineConfig } from "@playwright/test"
import config from "./playwright.config"

if (!process.env.DATABASE_URL_TEST || !process.env.REDIS_URL) {
  throw new Error("Set DATABASE_URL_TEST and REDIS_URL to disposable QA services (see docs/qa/execution.md).")
}
const schema = `school_test_address_${process.pid}`
Object.assign(process.env, {
  E2E_API_URL: "http://127.0.0.1:3102/api/v1",
})

export default defineConfig({
  ...config,
  use: { ...config.use, baseURL: "http://127.0.0.1:5174" },
  workers: 1,
  projects: [{ name: "address-real", testMatch: /critical\/school-address\.spec\.ts/, use: { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true } }],
  webServer: [
    {
      command: "node --import tsx tests/browser/school-address-server.ts",
      cwd: "../edutrack-api",
      url: "http://127.0.0.1:3102/health",
      reuseExistingServer: false,
      timeout: 60000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
      env: { QA_BROWSER_PORT: "3102", QA_BROWSER_SCHEMA: schema, SMS_MOCK: "true", NODE_ENV: "test" },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: { VITE_API_URL: "http://127.0.0.1:3102/api/v1", VITE_DEFAULT_TENANT_SCHEMA: schema, VITE_TENANT_SUBDOMAIN: "" },
    },
  ],
})

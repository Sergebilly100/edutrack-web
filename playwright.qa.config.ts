import { defineConfig } from "@playwright/test"
import config from "./playwright.config"

if (!process.env.DATABASE_URL_TEST || !process.env.REDIS_URL) {
  throw new Error("Set DATABASE_URL_TEST and REDIS_URL to disposable QA services (see docs/qa/execution.md).")
}
const schema = `school_test_browser_${process.pid}`
Object.assign(process.env, {
  E2E_API_URL: "http://127.0.0.1:3101/api/v1",
  E2E_SCHEMA_NAME: schema,
  E2E_DIRECTOR_IDENTIFIER: "2250701234567", E2E_DIRECTOR_PASSWORD: "director2024",
  E2E_STAFF_IDENTIFIER: "2250702345678", E2E_STAFF_PASSWORD: "staff2024",
  E2E_ADMIN_IDENTIFIER: "superadmin.integration@edutrack.local", E2E_ADMIN_PASSWORD: "SuperAdmin!2024",
  E2E_TEACHER_IDENTIFIER: "qa.teacher", E2E_TEACHER_PASSWORD: "edutrack2024",
  E2E_PARENT_PHONE: "2250700008898", E2E_PARENT_PASSWORD: "ParentQa!2026",
})

export default defineConfig({
  ...config,
  use: { ...config.use, baseURL: "http://127.0.0.1:5174" },
  workers: 1,
  projects: [...(config.projects ?? []).filter((project) => !project.name?.startsWith("setup-") || project.name === "setup-parent"), { name: "critical-real", testMatch: /critical\/.*\.spec\.ts/, use: { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true } }],
  webServer: [
    {
      command: "node --import tsx tests/browser/server.ts",
      cwd: "../edutrack-api",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
      timeout: 60000,
      stdout: "pipe",
      stderr: "pipe",
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
      env: { QA_BROWSER_PORT: "3101", QA_BROWSER_SCHEMA: schema, SMS_MOCK: "true", NODE_ENV: "test" },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: { VITE_API_URL: "http://127.0.0.1:3101/api/v1", VITE_DEFAULT_TENANT_SCHEMA: schema, VITE_TENANT_SUBDOMAIN: "" },
    },
  ],
})

import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup-director", testMatch: /setup\/auth\.setup\.ts/ },
    { name: "setup-teacher", testMatch: /setup\/teacher-auth\.setup\.ts/ },
    { name: "setup-admin", testMatch: /setup\/admin-auth\.setup\.ts/ },
    { name: "setup-staff", testMatch: /setup\/staff-auth\.setup\.ts/ },
    { name: "setup-parent", testMatch: /setup\/parent-auth\.setup\.ts/ },
    {
      name: "director-tests",
      use: { ...devices["Pixel 5"] },
      testMatch: /director\/.*\.spec\.ts/,
      testIgnore: /setup\//,
    },
    {
      name: "teacher-tests",
      use: { ...devices["Pixel 5"] },
      testMatch: /teacher\/.*\.spec\.ts/,
      testIgnore: /setup\//,
    },
    {
      name: "admin-tests",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /admin\/.*\.spec\.ts/,
      testIgnore: /setup\//,
    },
    {
      name: "staff-tests",
      use: { ...devices["Pixel 5"] },
      testMatch: /staff\/.*\.spec\.ts/,
      testIgnore: /setup\//,
    },
    {
      name: "parent-tests",
      use: { ...devices["Pixel 5"], storageState: "e2e/.auth/parent.json" },
      dependencies: ["setup-parent"],
      testMatch: /parent-portal\/.*\.spec\.ts/,
      testIgnore: /setup\//,
    },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
})

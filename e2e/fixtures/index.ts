import path from "node:path"

import { expect, test as base, type Page } from "@playwright/test"

type FillFormValues = Record<string, string | number>

type EduTrackFixtures = {
  directorPage: Page
  teacherPage: Page
}

export const test = base.extend<EduTrackFixtures>({
  directorPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({
      storageState: path.resolve(process.cwd(), "e2e/.auth/director.json"),
      baseURL,
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  teacherPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({
      storageState: path.resolve(process.cwd(), "e2e/.auth/teacher.json"),
      baseURL,
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect }

export const waitForToast = async (page: Page, text: string) => {
  const toast = page.locator("[data-sonner-toaster], [role='status'], [role='alert']").filter({ hasText: text }).first()
  await expect(toast).toBeVisible()
}

export const fillForm = async (page: Page, selectors: FillFormValues) => {
  for (const [selector, value] of Object.entries(selectors)) {
    await page.locator(selector).fill(String(value))
  }
}

export const confirmDialog = async (page: Page) => {
  const confirmButton = page
    .getByRole("button", { name: /confirmer|supprimer|valider|continuer|ok/i })
    .first()
  await expect(confirmButton).toBeVisible()
  await confirmButton.click()
}

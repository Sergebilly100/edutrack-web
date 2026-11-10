import { expect, type Page } from "@playwright/test"

// Les visites guidées ne démarrent plus jamais seules : il n'y a plus de clé à forcer.
// La fonction est conservée pour les parcours qui l'appellent encore (no-op volontaire).
export async function returningUser(_page: Page) {}

export async function navigateMenu(page: Page, group: string, label: string) {
  const open = page.getByRole("button", { name: "Ouvrir le menu de navigation" })
  const toggle = page.getByRole("button", { name: group, exact: true })
  await expect(open.or(toggle).first()).toBeVisible()
  if (await open.isVisible()) await open.click()
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click()
  await page.getByRole("link", { name: label, exact: true }).click()
}

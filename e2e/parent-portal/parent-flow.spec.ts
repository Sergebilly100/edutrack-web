import { expect, test } from "@playwright/test"

test.describe("Parent portal flow", () => {
  test.use({ storageState: "e2e/.auth/parent.json" })

  test("dashboard, absences et compte", async ({ page }) => {
    await page.route("**/api/v1/school/info", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ name: "E2E School" }),
      })
    })

    await page.goto("/parent/dashboard")
    if (page.url().includes("/parent/login")) {
      const credentials = await page.evaluate(() => ({
        phone: window.localStorage.getItem("e2e_parent_phone") ?? "",
        password: window.localStorage.getItem("e2e_parent_password") ?? "",
      }))
      await page.getByLabel("Votre numéro de téléphone").fill(credentials.phone)
      await page.getByLabel("Mot de passe").fill(credentials.password)
      await page.getByRole("button", { name: "Se connecter" }).click()
      await page.waitForURL("**/parent/dashboard**")
    }
    await expect(page.getByRole("heading", { name: "Tableau de bord parent" })).toBeVisible()
    await expect(page.getByText("absence(s)").first()).toBeVisible()

    const desktopProgram = page.locator("table.w-full.min-w-\\[900px\\]")
    const mobileProgramToggle = page.getByRole("button", { name: "Voir" }).first()
    const hasDesktopProgram = (await desktopProgram.count()) > 0 && (await desktopProgram.first().isVisible())
    if (!hasDesktopProgram) {
      await expect(mobileProgramToggle).toBeVisible()
    }

    await page.evaluate(() => {
      const link = document.querySelector('a[href="/parent/absences"]') as HTMLAnchorElement | null
      link?.click()
    })
    await expect(page).toHaveURL(/\/parent\/absences/)
    await expect(page.getByRole("heading", { name: /Historique des absences/ })).toBeVisible()

    await page.evaluate(() => {
      const link = document.querySelector('a[href="/parent/account"]') as HTMLAnchorElement | null
      link?.click()
    })
    await expect(page).toHaveURL(/\/parent\/account/)
    await expect(page.getByRole("heading", { name: "Mon compte" })).toBeVisible()

    const currentPassword = await page.evaluate(() => window.localStorage.getItem("e2e_parent_password") ?? "0000")
    await page.getByLabel("Mot de passe actuel").fill(currentPassword)
    await page.getByLabel("Nouveau mot de passe").fill("Parent1234!")
    await page.getByLabel("Confirmer le mot de passe").fill("Parent1234!")
    await page.getByRole("button", { name: "Enregistrer" }).click()
    await expect(page.getByText("Mot de passe mis à jour").first()).toBeVisible()
  })
})
